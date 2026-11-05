import type { JsonStore, StoreState } from "./store.js";

// Reuse the service's existing Neon database, in a separate payment-state table.
// No connection string is sent to the browser or included in logs.
export async function createPaymentDatabase(connection: string, initial: StoreState, request: typeof fetch = fetch): Promise<JsonStore> {
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)
    || !url.username || !url.password || url.pathname === "/" || (url.port && url.port !== "5432")) throw Error("Payment database must use a complete Neon connection URL");
  const endpoint = `https://${url.hostname.replace(/-pooler(?=\.)/, "")}/sql`;
  async function query(sql: string, params: string[] = []): Promise<string[][]> {
    const response = await request(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "Neon-Connection-String": connection,
        "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "true" },
      body: JSON.stringify({ query: sql, params })
    });
    if (!response.ok) throw Error("Payment database request failed");
    const result = await response.json() as { rows?: string[][] };
    if (!Array.isArray(result.rows)) throw Error("Unexpected payment database response");
    return result.rows;
  }
  function parse(raw: string): StoreState {
    const state = JSON.parse(raw) as StoreState;
    if (state.version !== 1 || ![state.intents, state.payments, state.pending, state.sponsorshipRequests,
      state.accessChallenges, state.accessSessions].every(Array.isArray)) throw Error("Invalid stored payment state");
    return state;
  }
  await query("CREATE TABLE IF NOT EXISTS nursebridge_payment_state (id integer PRIMARY KEY CHECK (id = 1), revision bigint NOT NULL DEFAULT 0, state jsonb NOT NULL)");
  await query("INSERT INTO nursebridge_payment_state (id, state) VALUES (1, $1::jsonb) ON CONFLICT DO NOTHING", [JSON.stringify(initial)]);
  async function load() {
    const rows = await query("SELECT revision::text, state::text FROM nursebridge_payment_state WHERE id = 1");
    if (rows.length !== 1) throw Error("Payment database state is missing");
    return { revision: rows[0][0], state: parse(rows[0][1]) };
  }
  let current = (await load()).state;
  let queue: Promise<void> = Promise.resolve();
  return {
    read: () => structuredClone(current),
    transact<T>(change: (draft: StoreState) => T | Promise<T>): Promise<T> {
      const operation = queue.then(async () => {
        const latest = await load();
        const draft = structuredClone(latest.state);
        const result = await change(draft);
        // Compare-and-swap prevents two live deployments from overwriting each
        // other's payments. A conflict fails closed; never grant unsaved access.
        const updated = await query("UPDATE nursebridge_payment_state SET state = $1::jsonb, revision = revision + 1 WHERE id = 1 AND revision = $2::bigint RETURNING revision::text", [JSON.stringify(draft), latest.revision]);
        if (updated.length !== 1) throw Error("Payment state changed concurrently; retry the request");
        current = draft;
        return result;
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    }
  };
}
