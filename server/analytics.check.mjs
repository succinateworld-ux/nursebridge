import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { authorized, parseEvent, summarize, installAnalytics } from './analytics.ts';

test('rejects malformed events and excludes arbitrary personal fields', () => {
  assert.equal(parseEvent(null), null);
  assert.equal(parseEvent({}), null);
  const input = { id: randomUUID(), learner: randomUUID(), name: 'visit', pathway: 'general', email: 'excluded@example.com' };
  const event = parseEvent(input, new Date('2026-10-28T23:59:00Z'));
  assert.equal(event.day, '2026-10-28');
  assert.notEqual(event.learner, input.learner);
  assert.equal('email' in event, false);
  assert.equal(parseEvent({ ...input, name: 'unknown' }), null);
  assert.equal(parseEvent({ ...input, pathway: 'unknown' }), null);
});
test('auth fails closed, rejects short configuration and requires exact bearer token', () => {
  const token = 'a'.repeat(40);
  assert.equal(authorized(undefined, undefined), false);
  assert.equal(authorized('Bearer short', 'short'), false);
  assert.equal(authorized('Bearer ' + token, token), true);
  assert.equal(authorized('Bearer ' + token + 'x', token), false);
});
test('unique counts, UTC boundaries, exact-day retention and immature cohorts', () => {
  const event = (learner, day, name = 'visit', pathway = 'general') => ({ id: randomUUID(), learner, day, name, pathway });
  const state = { startedAt: '2026-09-01T00:00:00Z', firstSeen: { a: '2026-10-01', b: '2026-10-21', c: '2026-10-28', old: '2026-09-01' }, events: [
    event('a', '2026-10-01'), event('a', '2026-10-08'), event('a', '2026-10-28', 'question_answered', 'nmcn-rn'),
    event('b', '2026-10-21'), event('b', '2026-10-28'), event('c', '2026-10-28'), event('old', '2026-10-28'), event('c', '2026-10-28')
  ] };
  const result = summarize(state, 30, new Date('2026-10-28T12:00:00Z'));
  assert.equal(result.dailyActive, 4);
  assert.equal(result.newLearners, 3);
  assert.equal(result.returningLearners, 1);
  assert.deepEqual(result.retention7, { eligible: 2, retained: 2, percent: 100 });
  assert.deepEqual(result.retention30, { eligible: 0, retained: 0, percent: null });
  assert.equal(result.counts.question_answered, 1);
  assert.equal(result.trend.length, 30);
  assert.equal(summarize(state, 7, new Date('2026-10-28')).returningLearners, 3);
});
test('ingestion persists, deduplicates retries, and admin endpoint rejects unauthenticated reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nursebridge-metrics-'));
  const routes = new Map();
  const app = { post: (path, handler) => routes.set(path, handler), get: (path, handler) => routes.set(path, handler) };
  const response = () => ({ code: 200, status(n) { this.code = n; return this; }, json(value) { this.body = value; return this; }, setHeader() { return this; }, end() {} });
  try {
    const file = join(directory, 'analytics.json');
    await installAnalytics(app, file);
    const req = { body: { id: randomUUID(), learner: randomUUID(), name: 'visit', pathway: 'general' } };
    await Promise.all([routes.get('/api/metrics/events')(req, response()), routes.get('/api/metrics/events')(req, response())]);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).events.length, 1);
    const res = response();
    routes.get('/api/admin/metrics')({ headers: {}, query: {} }, res);
    assert.equal(res.code, 401);
    const restarted = new Map();
    await installAnalytics({ post: (p, h) => restarted.set(p, h), get: (p, h) => restarted.set(p, h) }, file);
    assert.ok(restarted.has('/api/admin/metrics'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
