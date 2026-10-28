import type { MetricEvent, MetricsState } from "./analytics.js";

// Neon SQL-over-HTTPS protocol, using Node's built-in fetch. No browser credentials.
export function createMetricsDatabase(connectionString: string, request: typeof fetch = fetch) {
  let url: URL;
  try { url = new URL(connectionString); } catch { throw Error("Invalid metrics database URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname) || !url.username || !url.password || url.pathname === "/" || (url.port && url.port !== "5432")) throw Error("Metrics database must use a complete Neon connection URL");
  const endpoint = `https://${url.hostname.replace(/-pooler(?=\.)/, "")}/sql`;
  async function query(query: string, params: string[] = []): Promise<string[][]> {
    const response = await request(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json", "Neon-Connection-String": connectionString, "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "true" },
      body: JSON.stringify({ query, params })
    });
    if (!response.ok) throw Error("Metrics database request failed");
    const result = await response.json() as { rows?: string[][] };
    if (!Array.isArray(result.rows)) throw Error("Unexpected metrics database response");
    return result.rows;
  }
  return {
    async initialize() {
      await query("CREATE TABLE IF NOT EXISTS nursebridge_metric_meta (id integer PRIMARY KEY CHECK (id = 1), started_at timestamptz NOT NULL DEFAULT now())");
      await query("INSERT INTO nursebridge_metric_meta (id) VALUES (1) ON CONFLICT DO NOTHING");
      await query("CREATE TABLE IF NOT EXISTS nursebridge_metric_learners (learner text PRIMARY KEY, first_seen date NOT NULL DEFAULT CURRENT_DATE)");
      await query("CREATE TABLE IF NOT EXISTS nursebridge_metric_events (id uuid PRIMARY KEY, learner text NOT NULL, name text NOT NULL, pathway text NOT NULL, day date NOT NULL)");
      await query("CREATE INDEX IF NOT EXISTS nursebridge_metric_day ON nursebridge_metric_events (day)");
    },
    async record(event: MetricEvent) {
      // Event and first-seen record commit together; duplicate event IDs are idempotent.
      await query(`WITH inserted AS (
        INSERT INTO nursebridge_metric_events (id, learner, name, pathway, day)
        VALUES ($1::uuid, $2, $3, $4, $5::date) ON CONFLICT DO NOTHING RETURNING learner, day
      ) INSERT INTO nursebridge_metric_learners (learner, first_seen)
        SELECT learner, day FROM inserted ON CONFLICT (learner) DO UPDATE
        SET first_seen = LEAST(nursebridge_metric_learners.first_seen, EXCLUDED.first_seen)`,
      [event.id, event.learner, event.name, event.pathway, event.day]);
    },
    async prune() { await query("DELETE FROM nursebridge_metric_events WHERE day < (now() AT TIME ZONE 'UTC')::date - 90"); },
    async read(): Promise<MetricsState> {
      const rows = await query(`SELECT json_build_object(
        'startedAt', (SELECT started_at FROM nursebridge_metric_meta WHERE id = 1),
        'events', COALESCE((SELECT json_agg(json_build_object('id',id,'learner',learner,'name',name,'pathway',pathway,'day',day::text)) FROM nursebridge_metric_events WHERE day >= (now() AT TIME ZONE 'UTC')::date - 90), '[]'::json),
        'firstSeen', COALESCE((SELECT json_object_agg(learner,first_seen::text) FROM nursebridge_metric_learners), '{}'::json)
      )::text`);
      return JSON.parse(rows[0][0]) as MetricsState;
    }
  };
}
