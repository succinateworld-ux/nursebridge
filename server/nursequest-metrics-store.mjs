import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { emptyState } from './nursequest-metrics-core.mjs'

export function createFileStore(file) {
  let state, queue = Promise.resolve()
  return {
    async initialize() {
      await mkdir(dirname(file), {recursive:true})
      try { state=JSON.parse(await readFile(file,'utf8')); if (!Array.isArray(state.events)||!state.firstSeen||!state.startedAt) throw Error('Invalid metrics file') }
      catch(e) { if(e.code!=='ENOENT')throw e; state=emptyState() }
    },
    record(event) {
      const op=queue.then(async()=>{
        if(state.events.some(e=>e.id===event.id))return
        const draft=structuredClone(state), cutoff=new Date(Date.parse(event.day)-89*86400000).toISOString().slice(0,10)
        draft.events=draft.events.filter(e=>e.day>=cutoff);draft.events.push(event);draft.firstSeen[event.visitor]??=event.day
        await writeFile(file+'.tmp',JSON.stringify(draft),{mode:0o600});await rename(file+'.tmp',file);state=draft
      });queue=op.catch(()=>{});return op
    },
    async read(){await queue;return structuredClone(state)}
  }
}
export function createNeonStore(connectionString, request=fetch) {
  const url=new URL(connectionString)
  if(!['postgres:','postgresql:'].includes(url.protocol)||!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)||!url.username||!url.password||url.pathname==='/'||(url.port&&url.port!=='5432'))throw Error('A complete Neon connection URL is required')
  const endpoint=`https://${url.hostname.replace(/-pooler(?=\.)/,'')}/sql`
  async function query(query,params=[]) {
    const response=await request(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','Neon-Connection-String':connectionString,'Neon-Raw-Text-Output':'true','Neon-Array-Mode':'true'},body:JSON.stringify({query,params})})
    if(!response.ok)throw Error('Metrics database request failed')
    const data=await response.json();if(!Array.isArray(data.rows))throw Error('Invalid metrics database response');return data.rows
  }
  let pruned=''
  return {
    async initialize(){
      await query('CREATE TABLE IF NOT EXISTS nursequest_metric_meta (id integer PRIMARY KEY CHECK(id=1), started_at timestamptz NOT NULL DEFAULT now())')
      await query('INSERT INTO nursequest_metric_meta(id) VALUES(1) ON CONFLICT DO NOTHING')
      await query('CREATE TABLE IF NOT EXISTS nursequest_metric_visitors (visitor text PRIMARY KEY, first_seen date NOT NULL)')
      await query('CREATE TABLE IF NOT EXISTS nursequest_metric_events (id uuid PRIMARY KEY, visitor text NOT NULL, session text NOT NULL, run uuid, name text NOT NULL, mission text NOT NULL, source text NOT NULL, day date NOT NULL, time timestamptz NOT NULL)')
      await query('CREATE INDEX IF NOT EXISTS nursequest_metric_day ON nursequest_metric_events(day)')
    },
    async record(e){
      await query(`WITH inserted AS (INSERT INTO nursequest_metric_events(id,visitor,session,run,name,mission,source,day,time) VALUES($1::uuid,$2,$3,$4::uuid,$5,$6,$7,$8::date,$9::timestamptz) ON CONFLICT DO NOTHING RETURNING visitor,day) INSERT INTO nursequest_metric_visitors(visitor,first_seen) SELECT visitor,day FROM inserted ON CONFLICT(visitor) DO UPDATE SET first_seen=LEAST(nursequest_metric_visitors.first_seen,EXCLUDED.first_seen)`,[e.id,e.visitor,e.session,e.run,e.name,e.mission,e.source,e.day,e.time])
      if(pruned!==e.day){await query("DELETE FROM nursequest_metric_events WHERE day < (now() AT TIME ZONE 'UTC')::date - 89");pruned=e.day}
    },
    async read(){
      const rows=await query(`SELECT json_build_object('startedAt',(SELECT started_at FROM nursequest_metric_meta WHERE id=1),'events',COALESCE((SELECT json_agg(json_build_object('id',id,'visitor',visitor,'session',session,'run',run,'name',name,'mission',mission,'source',source,'day',day::text,'time',time)) FROM nursequest_metric_events WHERE day >= (now() AT TIME ZONE 'UTC')::date - 89),'[]'::json),'firstSeen',COALESCE((SELECT json_object_agg(visitor,first_seen::text) FROM nursequest_metric_visitors),'{}'::json))::text`)
      return JSON.parse(rows[0][0])
    }
  }
}
