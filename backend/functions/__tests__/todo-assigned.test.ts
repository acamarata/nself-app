/**
 * Purpose: Cover the assignment-notification handler, and pin the parts of it
 *   that were wrong in every previous version: the table names, the notification
 *   type, the payload nesting, and the fact that a failed mutation must surface.
 *
 * The contract assertions here are deliberately literal (exact table names, exact
 * type string). Fixtures that mirrored a wrong contract are how the attachments
 * bug and the original task-activity bug both stayed invisible.
 * SPORT: F08 backend functions — assignment notification.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { handleTodoAssigned, type GqlFn, type AssigneeEvent } from '../todo-assigned.js';

interface Call { query: string; variables: Record<string, unknown> }

function makeGql(
  todo: { id: string; title: string } | null,
  opts: { failMutation?: boolean } = {},
): { gql: GqlFn; calls: Call[] } {
  const calls: Call[] = [];
  const gql = (async (query: string, variables: Record<string, unknown> = {}) => {
    calls.push({ query, variables });
    if (query.includes('AssignedTodo')) return { np_todos_by_pk: todo };
    if (opts.failMutation) throw new Error('Hasura CreateAssignmentNotification returned errors');
    return { insert_np_notifications_one: { id: 'n1' } };
  }) as GqlFn;
  return { gql, calls };
}

const event = (over: Record<string, unknown> = {}): AssigneeEvent => ({
  trigger: { name: 'todo_assigned_trigger' },
  table: { schema: 'public', name: 'np_todo_assignees' },
  event: {
    op: 'INSERT',
    session_variables: { 'x-hasura-user-id': 'actor-1' },
    data: {
      old: null,
      new: {
        id: 'a1',
        todo_id: 't1',
        assignee_id: 'assignee-1',
        assigned_by: 'actor-1',
        ...over,
      },
    },
  },
});

describe('handleTodoAssigned', () => {
  test('inserts a notification for the assignee', async () => {
    const { gql, calls } = makeGql({ id: 't1', title: 'Pay the invoice' });
    const result = await handleTodoAssigned(event(), gql);

    assert.equal(result.notified, true);
    const mutation = calls.find((c) => c.query.includes('insert_np_notifications_one'));
    assert.ok(mutation, 'notification mutation was never issued');
    assert.equal(mutation.variables['userId'], 'assignee-1');
    assert.equal(mutation.variables['body'], 'Pay the invoice');
  });

  test('mutation targets the real tables — np_*, never app_*', async () => {
    const { gql, calls } = makeGql({ id: 't1', title: 'x' });
    await handleTodoAssigned(event(), gql);

    const docs = calls.map((c) => c.query).join('\n');
    assert.match(docs, /insert_np_notifications_one/);
    assert.match(docs, /np_todos_by_pk/);
    assert.doesNotMatch(docs, /insert_app_/, 'app_* tables do not exist in this schema');
  });

  test('notification type is a np_notifications_type_check member', async () => {
    // The DB constraint: new_todo | due_reminder | shared_list | evening_reminder
    // | location_reminder | list_update. Anything else is rejected at insert time.
    const ALLOWED = [
      'new_todo', 'due_reminder', 'shared_list',
      'evening_reminder', 'location_reminder', 'list_update',
    ];
    const { gql, calls } = makeGql({ id: 't1', title: 'x' });
    await handleTodoAssigned(event(), gql);

    const mutation = calls.find((c) => c.query.includes('insert_np_notifications_one'))!;
    const type = /type:\s*"([a-z_]+)"/.exec(mutation.query)?.[1];
    assert.ok(type, 'no literal type in the mutation document');
    assert.ok(ALLOWED.includes(type), `type "${type}" violates np_notifications_type_check`);
  });

  test('does not pass todo_id as a np_notifications column', async () => {
    // np_notifications has no todo_id column; the reference belongs in `data`.
    const { gql, calls } = makeGql({ id: 't1', title: 'x' });
    await handleTodoAssigned(event(), gql);

    const mutation = calls.find((c) => c.query.includes('insert_np_notifications_one'))!;
    assert.doesNotMatch(mutation.query, /^\s*todo_id:/m);
    assert.deepEqual(
      (mutation.variables['data'] as Record<string, unknown>)['todo_id'],
      't1',
    );
  });

  test('self-assignment notifies nobody', async () => {
    const { gql, calls } = makeGql({ id: 't1', title: 'x' });
    const result = await handleTodoAssigned(event({ assignee_id: 'actor-1' }), gql);

    assert.deepEqual(result, { notified: false, reason: 'self-assignment' });
    assert.equal(calls.length, 0);
  });

  test('a deleted todo is reported, not notified', async () => {
    const { gql } = makeGql(null);
    const result = await handleTodoAssigned(event(), gql);
    assert.deepEqual(result, { notified: false, reason: 'todo-missing' });
  });

  test('a failed mutation throws — it is never reported as success', async () => {
    const { gql } = makeGql({ id: 't1', title: 'x' }, { failMutation: true });
    await assert.rejects(() => handleTodoAssigned(event(), gql), /CreateAssignmentNotification/);
  });

  test('reads the row from event.data.new, not the top level', async () => {
    const { gql } = makeGql({ id: 't1', title: 'x' });
    // A payload shaped the old (wrong) way carries no event.data.new at all.
    const flat = { data: { old: null, new: { todo_id: 't1', assignee_id: 'u2' } } };
    const result = await handleTodoAssigned(flat as unknown as AssigneeEvent, gql);
    assert.equal(result.notified, false);
    assert.equal(result.reason, 'no-row');
  });
});
