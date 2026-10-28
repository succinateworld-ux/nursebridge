import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Express } from "express";
import { createMetricsDatabase } from "./metrics-database.js";

const DAY = 86_400_000;
export const eventNames = ["visit", "question_answered", "practice_started", "practice_completed", "exam_started", "exam_completed", "lesson_completed", "pathway_selected"] as const;
export interface MetricEvent { id: string; learner: string; name: typeof eventNames[number]; pathway: string; day: string }
export interface MetricsState { startedAt: string; events: MetricEvent[]; firstSeen: Record<string, string> }
const pathways = ["general", "nmcn-rn", "nmcn-rm", "nmcn-rphn", "nclex-rn", "nclex-pn"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseEvent(body: unknown, now = new Date()): MetricEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !uuid.test(b.id) || typeof b.learner !== "string" || !uuid.test(b.learner) || !eventNames.includes(b.name as MetricEvent["name"]) || !pathways.includes(b.pathway as string)) return null;
  return { id: b.id, learner: createHash("sha256").update(b.learner).digest("hex"), name: b.name as MetricEvent["name"], pathway: b.pathway as string, day: now.toISOString().slice(0, 10) };
}
export function summarize(state: MetricsState, days: number, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const date = (offset: number) => new Date(Date.parse(today) - offset * DAY).toISOString().slice(0, 10);
  const cutoff = date(days - 1);
  const events = state.events.filter(e => e.day >= cutoff && e.day <= today);
  const unique = (rows: MetricEvent[]) => new Set(rows.map(e => e.learner)).size;
  const active = (n: number) => unique(state.events.filter(e => e.day >= date(n - 1) && e.day <= today));
  const newcomers = Object.entries(state.firstSeen).filter(([, day]) => day >= cutoff && day <= today);
  const returning = unique(events.filter(e => state.firstSeen[e.learner] < cutoff));
  const retention = (n: number) => {
    const eligible = Object.entries(state.firstSeen).filter(([, day]) => day >= cutoff && day <= date(n));
    const retained = eligible.filter(([learner, day]) => state.events.some(e => e.learner === learner && e.day === new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10))).length;
    return { eligible: eligible.length, retained, percent: eligible.length ? Math.round(retained / eligible.length * 100) : null };
  };
  const counts = Object.fromEntries(eventNames.map(name => [name, events.filter(e => e.name === name).length]));
  return { startedAt: state.startedAt, generatedAt: now.toISOString(), days, activeLearners: unique(events), dailyActive: active(1), monthlyActive: active(30), newLearners: newcomers.length, returningLearners: returning, counts, retention7: retention(7), retention30: retention(30),
    trend: Array.from({ length: days }, (_, i) => { const day = date(days - i - 1); const rows = events.filter(e => e.day === day); return { day, active: unique(rows), answers: rows.filter(e => e.name === "question_answered").length }; }),
    pathways: pathways.map(pathway => { const rows = events.filter(e => e.pathway === pathway); return { pathway, learners: unique(rows), answers: rows.filter(e => e.name === "question_answered").length }; }) };
}
export function authorized(header: string | undefined, token: string | undefined): boolean {
  if (!token || token.length < 32 || !header?.startsWith("Bearer ")) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(token));
}
export async function installAnalytics(app: Express, file: string) {
  const databaseUrl = process.env.METRICS_DATABASE_URL;
  if (databaseUrl) {
    const database = createMetricsDatabase(databaseUrl);
    let ready: Promise<void> | undefined;
    const initialize = () => ready ??= database.initialize().catch(error => { ready = undefined; throw error; });
    let lastPruned = "";
    app.post("/api/metrics/events", async (req, res) => {
      const event = parseEvent(req.body);
      if (!event) { res.status(400).json({ error: "Invalid activity event." }); return; }
      try {
        await initialize();
        await database.record(event);
        if (lastPruned !== event.day) { await database.prune(); lastPruned = event.day; }
        res.status(204).end();
      } catch { res.status(503).json({ error: "Metrics storage is temporarily unavailable." }); }
    });
    app.get("/api/admin/metrics", async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (!authorized(req.headers.authorization, process.env.METRICS_ADMIN_TOKEN)) { res.status(401).json({ error: "Enter a valid admin token." }); return; }
      const days = Number(req.query.days ?? 30);
      if (![7, 30, 90].includes(days)) { res.status(400).json({ error: "Choose 7, 30 or 90 days." }); return; }
      try { await initialize(); res.json(summarize(await database.read(), days)); }
      catch { res.status(503).json({ error: "Metrics storage is temporarily unavailable." }); }
    });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    app.post("/api/metrics/events", (_req, res) => { res.status(503).json({ error: "Metrics database is not configured." }); });
    app.get("/api/admin/metrics", (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (!authorized(req.headers.authorization, process.env.METRICS_ADMIN_TOKEN)) { res.status(401).json({ error: "Enter a valid admin token." }); return; }
      res.status(503).json({ error: "Set METRICS_DATABASE_URL to enable persistent metrics." });
    });
    return;
  }
  await mkdir(dirname(file), { recursive: true });
  let state: MetricsState = { startedAt: new Date().toISOString(), events: [], firstSeen: {} };
  try { state = JSON.parse(await readFile(file, "utf8")); if (!Array.isArray(state.events) || !state.firstSeen || !state.startedAt) throw Error("Invalid analytics store"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  let queue = Promise.resolve();
  app.post("/api/metrics/events", async (req, res) => {
    const event = parseEvent(req.body);
    if (!event) { res.status(400).json({ error: "Invalid activity event." }); return; }
    const operation = queue.then(async () => {
      if (state.events.some(e => e.id === event.id)) return;
      const draft = structuredClone(state);
      draft.events = draft.events.filter(e => e.day >= new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10));
      draft.events.push(event);
      draft.firstSeen[event.learner] ??= event.day;
      await writeFile(file + ".tmp", JSON.stringify(draft), { mode: 0o600 });
      await rename(file + ".tmp", file);
      state = draft;
    });
    queue = operation.catch(() => {});
    await operation;
    res.status(204).end();
  });
  app.get("/api/admin/metrics", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!authorized(req.headers.authorization, process.env.METRICS_ADMIN_TOKEN)) { res.status(401).json({ error: "Enter a valid admin token. Server token must contain at least 32 characters." }); return; }
    const days = Number(req.query.days ?? 30);
    if (![7, 30, 90].includes(days)) { res.status(400).json({ error: "Choose 7, 30 or 90 days." }); return; }
    res.json(summarize(state, days));
  });
}
