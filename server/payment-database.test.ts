import { describe, expect, it } from "vitest";
import { createPaymentDatabase } from "./payment-database.js";
import type { StoreState } from "./store.js";

const initial = (): StoreState => ({ version: 1, intents: [], payments: [], pending: [], sponsorshipRequests: [], accessChallenges: [], accessSessions: [] });
const connection = "postgresql://test:secret@ep-example.eu.neon.tech/nursebridge";
function database() {
  let stored: string | undefined;
  let revision = 0;
  let rejectWrites = false;
  const request = (async (_url: unknown, options?: RequestInit) => {
    const { query, params } = JSON.parse(String(options?.body)) as { query: string; params: string[] };
    let rows: string[][] = [];
    if (query.startsWith("INSERT") && !stored) stored = params[0];
    if (query.startsWith("SELECT")) rows = [[String(revision), stored!]];
    if (query.startsWith("UPDATE")) {
      if (rejectWrites) return new Response("Unavailable", { status: 503 });
      if (params[1] === String(revision)) { stored = params[0]; rows = [[String(++revision)]]; }
    }
    return Response.json({ rows });
  }) as typeof fetch;
  return { request, fail: () => { rejectWrites = true; }, resume: () => { rejectWrites = false; } };
}

describe("durable payment records", () => {
  it("restores records in a new server instance without replacing existing database state", async () => {
    const db = database();
    const first = await createPaymentDatabase(connection, initial(), db.request);
    await first.transact(state => state.sponsorshipRequests.push({ id: "request-1", requesterKeyHash: "pseudonym", status: "pending", createdAt: "2026-11-05", updatedAt: "2026-11-05" }));
    const restarted = await createPaymentDatabase(connection, initial(), db.request);
    expect(restarted.read().sponsorshipRequests[0].id).toBe("request-1");
    const snapshot = restarted.read(); snapshot.sponsorshipRequests.length = 0;
    expect(restarted.read().sponsorshipRequests).toHaveLength(1);
  });
  it("does not expose uncommitted access and recovers after a failed write", async () => {
    const db = database();
    const store = await createPaymentDatabase(connection, initial(), db.request);
    db.fail();
    await expect(store.transact(state => { state.accessSessions.push({ tokenHash: "secret-hash", wallet: "0x1111111111111111111111111111111111111111", createdAt: "now", expiresAt: "later" }); })).rejects.toThrow(/request failed/);
    expect(store.read().accessSessions).toEqual([]);
    db.resume();
    await store.transact(state => { state.pending = []; });
    expect(store.read().accessSessions).toEqual([]);
  });
  it("rejects a stale concurrent writer instead of losing a committed record", async () => {
    const db = database();
    const first = await createPaymentDatabase(connection, initial(), db.request);
    const second = await createPaymentDatabase(connection, initial(), db.request);
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const stale = first.transact(async state => { started(); await gate; state.accessSessions = []; });
    await entered;
    await second.transact(state => state.sponsorshipRequests.push({ id: "winner", requesterKeyHash: "key", status: "pending", createdAt: "now", updatedAt: "now" }));
    release();
    await expect(stale).rejects.toThrow(/concurrently/);
    const restarted = await createPaymentDatabase(connection, initial(), db.request);
    expect(restarted.read().sponsorshipRequests[0].id).toBe("winner");
  });
});
