/**
 * Purpose: Cover the evening digest, with a fixed clock, and pin the two
 *   properties that decide whether it is a feature or a nuisance: it computes
 *   the right day, and it never sends twice.
 * SPORT: F08 backend functions — evening digest.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runEveningDigest, type GqlFn } from '../evening-digest.js';

// 2026-08-24 21:30 UTC — "tomorrow" is 2026-08-25.
const NOW = new Date('2026-08-24T21:30:00.000Z');

interface Call { query: string; variables: Record<string, unknown> }

function makeGql(opts: {
  todos?: Array<{ id: string; user_id: string; title: string }>;
  prefs?: Array<{ user_id: string; notification_settings: unknown }>;
  alreadySent?: Array<{ user_id: string }>;
  failInsert?: boolean;
}) {
  const calls: Call[] = [];
  const gql = (async (query: string, variables: Record<string, unknown> = {}) => {
    calls.push({ query, variables });
    if (query.includes('TodosDueTomorrow')) return { np_todos: opts.todos ?? [] };
    if (query.includes('DigestState')) {
      return {
        np_user_preferences: opts.prefs ?? [],
        np_notifications: opts.alreadySent ?? [],
      };
    }
    if (opts.failInsert) throw new Error('Hasura CreateEveningDigest returned errors');
    return { insert_np_notifications_one: { id: 'n1' } };
  }) as GqlFn;
  return { gql, calls };
}

const todo = (user: string, title: string, id = title) => ({ id, user_id: user, title });

describe('runEveningDigest', () => {
  test('queries exactly tomorrow, in UTC', async () => {
    const { gql, calls } = makeGql({});
    await runEveningDigest(NOW, gql);

    const q = calls[0]!;
    assert.equal(q.variables['from'], '2026-08-25T00:00:00.000Z');
    assert.equal(q.variables['to'], '2026-08-26T00:00:00.000Z');
  });

  test('one notification per user, whatever the task count', async () => {
    const { gql, calls } = makeGql({
      todos: [todo('u1', 'Pay rent'), todo('u1', 'Call bank'), todo('u2', 'Ship release')],
    });
    const r = await runEveningDigest(NOW, gql);

    assert.deepEqual(r, { users: 2, notified: 2, skipped: 0, failed: 0 });
    const inserts = calls.filter((c) => c.query.includes('insert_np_notifications_one'));
    assert.equal(inserts.length, 2);
    const u1 = inserts.find((c) => c.variables['userId'] === 'u1')!;
    assert.equal(u1.variables['title'], '2 tasks due tomorrow');
    assert.equal(u1.variables['body'], 'Pay rent, Call bank');
  });

  test('singular wording for a single task', async () => {
    const { gql, calls } = makeGql({ todos: [todo('u1', 'Pay rent')] });
    await runEveningDigest(NOW, gql);
    const insert = calls.find((c) => c.query.includes('insert_np_notifications_one'))!;
    assert.equal(insert.variables['title'], '1 task due tomorrow');
  });

  test('long lists degrade to "and N more" rather than a wall of titles', async () => {
    const titles = ['a', 'b', 'c', 'd', 'e'];
    const { gql, calls } = makeGql({ todos: titles.map((t) => todo('u1', t)) });
    await runEveningDigest(NOW, gql);
    const insert = calls.find((c) => c.query.includes('insert_np_notifications_one'))!;
    assert.equal(insert.variables['body'], 'a, b, c and 2 more');
  });

  test('a second run on the same day inserts nothing', async () => {
    const { gql, calls } = makeGql({
      todos: [todo('u1', 'Pay rent')],
      alreadySent: [{ user_id: 'u1' }],
    });
    const r = await runEveningDigest(NOW, gql);

    assert.deepEqual(r, { users: 1, notified: 0, skipped: 1, failed: 0 });
    assert.equal(calls.filter((c) => c.query.includes('insert_np_notifications_one')).length, 0);
  });

  test('the same-day guard starts at midnight UTC, not 24h back', async () => {
    const { gql, calls } = makeGql({ todos: [todo('u1', 'x')] });
    await runEveningDigest(NOW, gql);
    const state = calls.find((c) => c.query.includes('DigestState'))!;
    assert.equal(state.variables['since'], '2026-08-24T00:00:00.000Z');
  });

  test('users who turned in-app notifications off are skipped', async () => {
    const { gql, calls } = makeGql({
      todos: [todo('u1', 'x'), todo('u2', 'y')],
      prefs: [{ user_id: 'u1', notification_settings: { push: true, email: true, inApp: false } }],
    });
    const r = await runEveningDigest(NOW, gql);

    assert.equal(r.skipped, 1);
    assert.equal(r.notified, 1);
    const inserts = calls.filter((c) => c.query.includes('insert_np_notifications_one'));
    assert.equal(inserts[0]!.variables['userId'], 'u2');
  });

  test('absent or null settings mean the digest is on', async () => {
    // The column default predates the inApp key; treating "missing" as "off"
    // would silently disable the feature for every existing account.
    const { gql } = makeGql({
      todos: [todo('u1', 'x'), todo('u2', 'y')],
      prefs: [
        { user_id: 'u1', notification_settings: null },
        { user_id: 'u2', notification_settings: { push: true, email: true } },
      ],
    });
    const r = await runEveningDigest(NOW, gql);
    assert.equal(r.notified, 2);
  });

  test('no tasks due tomorrow does no work at all', async () => {
    const { gql, calls } = makeGql({ todos: [] });
    const r = await runEveningDigest(NOW, gql);
    assert.deepEqual(r, { users: 0, notified: 0, skipped: 0, failed: 0 });
    assert.equal(calls.length, 1, 'must not query state for an empty set');
  });

  test('one failing user does not abort the batch', async () => {
    const { gql } = makeGql({
      todos: [todo('u1', 'x'), todo('u2', 'y')],
      failInsert: true,
    });
    const r = await runEveningDigest(NOW, gql);
    assert.deepEqual(r, { users: 2, notified: 0, skipped: 0, failed: 2 });
  });

  test('notification type is the constraint-legal evening_reminder', async () => {
    const { gql, calls } = makeGql({ todos: [todo('u1', 'x')] });
    await runEveningDigest(NOW, gql);
    const insert = calls.find((c) => c.query.includes('insert_np_notifications_one'))!;
    assert.match(insert.query, /type:\s*"evening_reminder"/);
  });
});
