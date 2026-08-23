/**
 * Purpose: Cover the reminder dispatcher — the step that was missing entirely,
 *   so reminders were storable on every surface and delivered on none.
 *
 * The interesting cases are the ones that decide whether a row is retried
 * forever or dropped silently, so each is asserted on its own.
 * SPORT: F08 backend functions — reminder delivery.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchReminders, type GqlFn } from '../reminder-dispatch.js';

const NOW = new Date('2026-03-10T12:00:00.000Z');

interface Call { query: string; variables: Record<string, unknown> }

function makeGql(
  reminders: unknown[],
  onMutation?: (call: Call) => void,
): { gql: GqlFn; calls: Call[] } {
  const calls: Call[] = [];
  const gql = (async (query: string, variables: Record<string, unknown> = {}) => {
    calls.push({ query, variables });
    if (query.includes('DueReminders')) return { np_reminders: reminders };
    onMutation?.({ query, variables });
    return {};
  }) as GqlFn;
  return { gql, calls };
}

const reminder = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  user_id: 'u1',
  todo_id: 't1',
  remind_at: '2026-03-10T11:59:00.000Z',
  todo: { id: 't1', title: 'Pay the invoice', completed: false },
  ...over,
});

describe('dispatchReminders', () => {
  test('does nothing when nothing is due', async () => {
    const { gql, calls } = makeGql([]);
    const r = await dispatchReminders(NOW, gql);
    assert.deepEqual(r, { due: 0, notified: 0, failed: 0, skipped: 0 });
    assert.equal(calls.length, 1, 'only the fetch should run');
  });

  test('only asks for unsent reminders at or before now', async () => {
    const { gql, calls } = makeGql([]);
    await dispatchReminders(NOW, gql);
    assert.equal(calls[0]!.variables['now'], NOW.toISOString());
    // The sent:false + _lte filter is what makes a retry or an overrunning cron
    // safe; without it the same row notifies every minute.
    assert.match(calls[0]!.query, /sent: \{ _eq: false \}/);
    assert.match(calls[0]!.query, /_lte: \$now/);
  });

  test('creates a notification carrying the task title, then marks sent', async () => {
    const mutations: Call[] = [];
    const { gql } = makeGql([reminder()], (c) => mutations.push(c));

    const r = await dispatchReminders(NOW, gql);

    assert.deepEqual(r, { due: 1, notified: 1, failed: 0, skipped: 0 });
    assert.equal(mutations.length, 2);
    assert.match(mutations[0]!.query, /CreateReminderNotification/);
    // Pinned to the DB CHECK constraint np_notifications_type_check. "reminder"
    // is NOT an allowed value and Hasura rejects the insert outright — which is
    // exactly how this shipped broken the first time.
    assert.match(mutations[0]!.query, /type: "due_reminder"/);
    assert.equal(mutations[0]!.variables['userId'], 'u1');
    assert.equal(mutations[0]!.variables['body'], 'Pay the invoice');
    assert.match(mutations[1]!.query, /MarkReminderSent/);
    assert.equal(mutations[1]!.variables['id'], 'r1');
  });

  test('notifies BEFORE marking sent', async () => {
    // Order matters: marking first and then failing to notify loses the
    // reminder permanently. A duplicate notification is the lesser harm.
    const order: string[] = [];
    const { gql } = makeGql([reminder()], (c) => {
      order.push(c.query.includes('CreateReminderNotification') ? 'notify' : 'mark');
    });
    await dispatchReminders(NOW, gql);
    assert.deepEqual(order, ['notify', 'mark']);
  });

  test('marks a completed task reminder sent WITHOUT notifying', async () => {
    // Nobody wants reminding about something they finished — but leaving it
    // unsent would retry it every minute forever.
    const mutations: Call[] = [];
    const { gql } = makeGql(
      [reminder({ todo: { id: 't1', title: 'Done thing', completed: true } })],
      (c) => mutations.push(c),
    );

    const r = await dispatchReminders(NOW, gql);

    assert.deepEqual(r, { due: 1, notified: 0, failed: 0, skipped: 1 });
    assert.equal(mutations.length, 1);
    assert.match(mutations[0]!.query, /MarkReminderSent/);
  });

  test('marks an orphaned reminder sent WITHOUT notifying', async () => {
    const mutations: Call[] = [];
    const { gql } = makeGql([reminder({ todo: null })], (c) => mutations.push(c));

    const r = await dispatchReminders(NOW, gql);

    assert.deepEqual(r, { due: 1, notified: 0, failed: 0, skipped: 1 });
    assert.match(mutations[0]!.query, /MarkReminderSent/);
  });

  test('one failure does not abort the batch, and leaves that row unsent', async () => {
    const marked: string[] = [];
    const calls: Call[] = [];
    const gql = (async (query: string, variables: Record<string, unknown> = {}) => {
      calls.push({ query, variables });
      if (query.includes('DueReminders')) {
        return {
          np_reminders: [
            reminder({ id: 'bad', todo: { id: 't1', title: 'Explodes', completed: false } }),
            reminder({ id: 'good', todo: { id: 't2', title: 'Fine', completed: false } }),
          ],
        };
      }
      if (query.includes('CreateReminderNotification') && variables['body'] === 'Explodes') {
        throw new Error('hasura is unhappy');
      }
      if (query.includes('MarkReminderSent')) marked.push(String(variables['id']));
      return {};
    }) as GqlFn;

    const r = await dispatchReminders(NOW, gql);

    assert.deepEqual(r, { due: 2, notified: 1, failed: 1, skipped: 0 });
    // The failed one must NOT be marked sent, or the next run cannot retry it.
    assert.deepEqual(marked, ['good']);
  });

  test('caps the batch so a backlog cannot build an unbounded query', async () => {
    const { gql, calls } = makeGql([]);
    await dispatchReminders(NOW, gql);
    assert.equal(calls[0]!.variables['limit'], 200);
  });
});
