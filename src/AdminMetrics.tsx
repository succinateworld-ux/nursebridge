import { useState } from "react";
import "./metrics.css";

interface Retention { eligible: number; retained: number; percent: number | null }
interface Metrics {
  startedAt: string; generatedAt: string; days: number; activeLearners: number; dailyActive: number; monthlyActive: number;
  newLearners: number; returningLearners: number; counts: Record<string, number>; retention7: Retention; retention30: Retention;
  trend: { day: string; active: number; answers: number }[];
  pathways: { pathway: string; learners: number; answers: number }[];
}
export default function AdminMetrics() {
  const [token, setToken] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/metrics?days=${days}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) { setData(null); throw Error(response.status === 401 ? "Access denied. Check your admin token and server configuration." : response.status === 503 ? "Metrics storage is unavailable. Check the server’s database configuration and try again." : "Metrics could not be loaded. Try again."); }
      setData(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to connect."); }
    finally { setBusy(false); }
  }
  const rate = (r: Retention) => r.percent === null ? "Awaiting eligible learners" : `${r.percent}% · ${r.retained} of ${r.eligible} learners`;
  return <main className="metrics-page">
    <header><a href="#home">← NurseBridge</a><span>ADMIN ANALYTICS</span><h1>Understand your learners.</h1><p>Activity, engagement and return visits across NurseBridge.</p></header>
    <form onSubmit={e => { e.preventDefault(); void load(); }} className="metrics-controls">
      <label>Admin token<input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} required /></label>
      <label>Period<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
      <button disabled={busy}>{busy ? "Loading…" : data ? "Refresh metrics" : "View metrics"}</button>
      {data && <button type="button" onClick={() => { setToken(""); setData(null); setError(""); }}>Lock dashboard</button>}
    </form>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <section className="metrics-panel"><h2>Your metrics are protected</h2><p>Enter your server’s admin token to view aggregate activity. Your token stays in memory for this page.</p></section>}
    {data && <>
      <p className="metrics-note">Updated {new Date(data.generatedAt).toLocaleString()} · Reporting period: {data.days} days · Collection began {new Date(data.startedAt).toLocaleDateString()}.</p>
      <section className="metrics-grid" aria-label="Key metrics">{[
        ["Active today (UTC)", data.dailyActive], ["Active in 30 days", data.monthlyActive], [`Active in ${data.days} days`, data.activeLearners], ["New learners", data.newLearners], ["Returning learners", data.returningLearners], ["Questions answered", data.counts.question_answered], ["Practice sets completed", data.counts.practice_completed], ["Mock exams completed", data.counts.exam_completed], ["Lessons completed", data.counts.lesson_completed]
      ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></article>)}</section>
      {data.activeLearners === 0 && <p>No activity recorded in this period yet. Counts will appear as learners use the updated app.</p>}
      <section className="metrics-panel"><h2>Daily active learners</h2><div className="metrics-bars" role="img" aria-label="Daily active learner chart; exact values appear in the expandable table below">{data.trend.map(row => <div key={row.day} title={`${row.day}: ${row.active} learners`}><i style={{ height: `${row.active / Math.max(1, ...data.trend.map(r => r.active)) * 150}px` }} /></div>)}</div><p>{data.trend[0].day} — {data.trend.at(-1)?.day} · UTC</p>
      <details><summary>View daily counts</summary><div className="metrics-table"><table><thead><tr><th>Date (UTC)</th><th>Active learners</th><th>Answers</th></tr></thead><tbody>{data.trend.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.active}</td><td>{row.answers}</td></tr>)}</tbody></table></div></details></section>
      <section className="metrics-panel"><h2>Return visits</h2><p><strong>Day 7:</strong> {rate(data.retention7)}</p><p><strong>Day 30:</strong> {rate(data.retention30)}</p><p>Among learners first seen in this reporting period whose day 7 or 30 has arrived, the share active on that exact UTC day. New cohorts need time to mature.</p></section>
      <section className="metrics-panel"><h2>Exam pathways</h2><div className="metrics-table"><table><thead><tr><th>Pathway</th><th>Active learners</th><th>Answers</th></tr></thead><tbody>{data.pathways.map(row => <tr key={row.pathway}><td>{row.pathway === "general" ? "General / no pathway" : row.pathway.toUpperCase()}</td><td>{row.learners}</td><td>{row.answers}</td></tr>)}</tbody></table></div><p>A learner using multiple pathways appears in each.</p></section>
      <section className="metrics-panel"><h2>Session engagement</h2><p>Practice sets started: {data.counts.practice_started} · Mock exams started: {data.counts.exam_started}</p><p>Completions count when learners finish a set or submit a mock exam. Starts and completions can fall in different periods.</p></section>
      <p className="metrics-note">Learners are anonymous browser IDs, not accounts or verified people. New means first observed here; returning means first observed before the selected period. Clearing storage or changing devices creates a new ID. Opt-outs, blocked requests and offline activity are excluded. Activity is self-reported, not audited usage. Event history is retained for 90 days; anonymous first-seen dates remain for return-visit measurement. No historical browser progress is imported.</p>
    </>}
  </main>;
}
