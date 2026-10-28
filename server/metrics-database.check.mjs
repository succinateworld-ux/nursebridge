import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMetricsDatabase } from './metrics-database.js';
const connection = 'postgresql://owner:test-password@ep-example-pooler.us-east-2.aws.neon.tech/db?sslmode=require';
test('database validates destination before transmitting credentials', () => {
  assert.throws(() => createMetricsDatabase('postgresql://owner:password@attacker.example/db'));
  assert.throws(() => createMetricsDatabase('https://ep-example.us-east-2.aws.neon.tech/db'));
});
test('database uses HTTPS, rejects redirects, parameterizes values and never includes credentials in errors', async () => {
  const calls = [];
  const db = createMetricsDatabase(connection, async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ rows: [] }) };
  });
  await db.initialize();
  await db.record({ id: 'test-id', learner: "test'learner", name: 'visit', pathway: 'general', day: '2026-10-28' });
  const call = calls.at(-1);
  assert.equal(call.url, 'https://ep-example.us-east-2.aws.neon.tech/sql');
  assert.equal(call.options.redirect, 'error');
  const body = JSON.parse(call.options.body);
  assert.ok(!body.query.includes("test'learner"));
  assert.equal(body.params[1], "test'learner");
  assert.ok(body.query.includes('ON CONFLICT DO NOTHING'));
  const failing = createMetricsDatabase(connection, async () => ({ ok: false }));
  await assert.rejects(failing.read(), { message: 'Metrics database request failed' });
});
test('database decodes persisted state and bounds history', async () => {
  const state = { startedAt: '2026-10-28T00:00:00Z', events: [], firstSeen: {} };
  const db = createMetricsDatabase(connection, async (_url, options) => {
    assert.ok(JSON.parse(options.body).query.includes("AT TIME ZONE 'UTC'"));
    return { ok: true, json: async () => ({ rows: [[JSON.stringify(state)]] }) };
  });
  assert.deepEqual(await db.read(), state);
});
