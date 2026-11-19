import { createHash, timingSafeEqual } from 'node:crypto'

export const names = ['visit','mission_started','mission_completed','decision_submitted','supply_started','supply_completed','attack_blocked','victory_downloaded']
export const missions = ['hub','aftershock','ward-practice','caremandate']
export const sources = ['direct','tiktok','instagram','facebook','x','whatsapp','mezo','near','other']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = value => createHash('sha256').update(`nursequest:${value}`).digest('hex')
const DAY = 86400000
export function parseEvent(body, now = new Date()) {
  if (!body || typeof body !== 'object' || typeof body.id!=='string' || typeof body.visitor!=='string' || typeof body.session!=='string' || !uuid.test(body.id) || !uuid.test(body.visitor) || !uuid.test(body.session) || !names.includes(body.name) || !missions.includes(body.mission) || !sources.includes(body.source)) return null
  if (body.name === 'visit' ? body.mission !== 'hub' || body.run != null : !uuid.test(body.run) || body.mission === 'hub') return null
  if (['supply_started','supply_completed','attack_blocked'].includes(body.name) !== (body.mission === 'caremandate')) return null
  if (body.name === 'victory_downloaded' && body.mission !== 'aftershock') return null
  return { id: body.id.toLowerCase(), visitor: hash(body.visitor.toLowerCase()), session: hash(body.session.toLowerCase()), run: body.run?.toLowerCase() ?? null, name: body.name, mission: body.mission, source: body.source, day: now.toISOString().slice(0,10), time: now.toISOString() }
}
export function authorized(header, token) {
  if (typeof token !== 'string' || token.length < 32 || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  return timingSafeEqual(Buffer.from(hash(header.slice(7)), 'hex'), Buffer.from(hash(token), 'hex'))
}
export function emptyState(now = new Date()) { return { startedAt: now.toISOString(), events: [], firstSeen: {} } }
export function summarize(state, days = 30, now = new Date()) {
  if(![7,30,90].includes(days))throw Error('Choose 7, 30 or 90 days')
  const today = now.toISOString().slice(0,10)
  const date = n => new Date(Date.parse(today) - n*DAY).toISOString().slice(0,10)
  const rows = state.events.filter(e => e.day >= date(days-1) && e.day <= today)
  const unique = (items, key) => new Set(items.map(key)).size
  const runKey = e => `${e.mission}:${e.run}`
  const starts = rows.filter(e => ['mission_started','supply_started'].includes(e.name))
  const completed = new Set(rows.filter(e => ['mission_completed','supply_completed'].includes(e.name)).map(runKey))
  const started = new Set(starts.map(runKey))
  const matched = [...started].filter(k => completed.has(k)).length
  const visitors = [...new Set(rows.map(e => e.visitor))]
  return {
    startedAt: state.startedAt, generatedAt: now.toISOString(), days,
    visitors: visitors.length, visits: rows.filter(e => e.name === 'visit').length, sessions: unique(rows, e=>e.session),
    activeToday: unique(rows.filter(e=>e.day===today),e=>e.visitor),
    newVisitors: visitors.filter(v=>state.firstSeen[v]>=date(days-1)).length,
    returningVisitors: visitors.filter(v=>state.firstSeen[v]<date(days-1)).length,
    starts: started.size, completions: completed.size, matchedCompletions: matched,
    completionPercent: started.size ? Math.round(matched/started.size*100) : null,
    decisions: rows.filter(e=>e.name==='decision_submitted').length,
    downloads: unique(rows.filter(e=>e.name==='victory_downloaded'),runKey),
    blockedAttacks: unique(rows.filter(e=>e.name==='attack_blocked'),runKey),
    trend: Array.from({length:days},(_,i)=>{const day=date(days-i-1), r=rows.filter(e=>e.day===day);return {day,visitors:unique(r,e=>e.visitor),visits:r.filter(e=>e.name==='visit').length,starts:unique(r.filter(e=>['mission_started','supply_started'].includes(e.name)),runKey),completions:unique(r.filter(e=>['mission_completed','supply_completed'].includes(e.name)),runKey)}}),
    missions: missions.filter(m=>m!=='hub').map(mission=>{const r=rows.filter(e=>e.mission===mission);return {mission,players:unique(r,e=>e.visitor),starts:unique(r.filter(e=>['mission_started','supply_started'].includes(e.name)),runKey),completions:unique(r.filter(e=>['mission_completed','supply_completed'].includes(e.name)),runKey)}}),
    sources: sources.map(source=>{const r=rows.filter(e=>e.source===source);return {source,visitors:unique(r,e=>e.visitor),visits:r.filter(e=>e.name==='visit').length}}).filter(r=>r.visitors)
  }
}
