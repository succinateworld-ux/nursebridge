import { authorized, parseEvent, summarize } from './nursequest-metrics-core.mjs'
import { createFileStore, createNeonStore } from './nursequest-metrics-store.mjs'

export function createMetricsHandler(options={}) {
  const production=options.production??process.env.NODE_ENV==='production'
  const origins=new Set(options.origins??['https://succinateworld-ux.github.io',...(!production?['http://127.0.0.1:5173','http://localhost:5173']:[])])
  const token=options.token??process.env.NURSEQUEST_METRICS_ADMIN_TOKEN??process.env.METRICS_ADMIN_TOKEN
  const connection=options.databaseUrl??process.env.NURSEQUEST_METRICS_DATABASE_URL??process.env.METRICS_DATABASE_URL
  let store=options.store, setupError=false
  try{store??=connection?createNeonStore(connection):!production?createFileStore(options.file??'.metrics-local/nursequest.json'):null}catch{setupError=true}
  let ready, limits=new Map()
  const initialize=()=>ready??=store.initialize().catch(e=>{ready=undefined;throw e})
  function rate(key,max){const now=Date.now();let v=limits.get(key);if(!v||v.until<=now){v={n:0,until:now+60000};limits.set(key,v)};if(limits.size>5000){for(const [k,v]of limits)if(v.until<=now)limits.delete(k);if(limits.size>5000)return false};return ++v.n<=max}
  return async function handler(req,res){
    const origin=req.headers.origin, path=new URL(req.url,'http://localhost').pathname
    res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff')
    const send=(status,data)=>{res.statusCode=status;if(data===undefined){res.end();return};res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
    if(origin&&!origins.has(origin)){send(403,{error:'Origin not allowed'});return}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization')}
    if(req.method==='OPTIONS'){send(204);return}
    const ip=req.socket?.remoteAddress??'unknown'
    if(!rate(`${ip}:${path==='/summary'?'admin':'event'}`,path==='/summary'?30:1800)){res.setHeader('Retry-After','60');send(429,{error:'Please try again in a minute'});return}
    if(path==='/health'&&req.method==='GET'){send(200,{ok:true,configured:!!store&&!setupError});return}
    if(path==='/summary'&&req.method==='GET'){
      if(!authorized(req.headers.authorization,token)){send(401,{error:'Enter a valid owner access token'});return}
      const days=Number(new URL(req.url,'http://localhost').searchParams.get('days')??30)
      if(![7,30,90].includes(days)){send(400,{error:'Choose 7, 30 or 90 days'});return}
      if(!store||setupError){send(503,{error:'Persistent metrics storage is not configured'});return}
      try{await initialize();send(200,summarize(await store.read(),days))}catch{send(503,{error:'Metrics storage is temporarily unavailable'})};return
    }
    if(path==='/events'&&req.method==='POST'){
      if(production&&!origin){send(403,{error:'A permitted browser origin is required'});return}
      if(!String(req.headers['content-type']??'').startsWith('application/json')){send(415,{error:'Send JSON activity data'});return}
      if(Number(req.headers['content-length']??0)>8192){req.resume?.();send(413,{error:'Activity data is too large'});return}
      let body
      try{
        if(req.body!==undefined){body=req.body;if(Buffer.byteLength(JSON.stringify(body))>8192)throw Error('large')}
        else{let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('large');raw+=chunk.toString()};body=JSON.parse(raw)}
      }catch{send(400,{error:'Invalid or oversized activity data'});return}
      const event=parseEvent(body)
      if(!event){send(400,{error:'Invalid activity event'});return}
      if(!rate(`browser:${event.visitor}`,90)){res.setHeader('Retry-After','60');send(429,{error:'Please slow down'});return}
      if(!store||setupError){send(503,{error:'Metrics storage is not configured'});return}
      try{await initialize();await store.record(event);send(204)}catch{send(503,{error:'Metrics storage is temporarily unavailable'})};return
    }
    send(404,{error:'Not found'})
  }
}
