/**
 * Purpose: Notify a user when someone assigns them a todo.
 *
 * Inputs:  Hasura event-trigger payload for INSERT on public.np_todo_assignees.
 * Outputs: { notified: boolean, reason?: string } — reason names why nothing was
 *          written, so a "did nothing" run is distinguishable from a broken one.
 *
 * Why this file replaces task-activity.ts (2026-08-24 completeness review):
 *   The old handler could not work on any environment, for five separate reasons:
 *     1. it mutated `insert_app_activity_one` / `insert_app_notifications_one`;
 *        the tables are `np_activity` / `np_notifications`;
 *     2. it wrote `type: 'task_assigned'`, which np_notifications_type_check
 *        rejects outright;
 *     3. it passed `todo_id` as a column of np_notifications — that column does
 *        not exist (todo references belong in the `data` jsonb);
 *     4. it read `event.data.new` off the top level of the payload; Hasura nests
 *        the row under `event.data.new`, so `task` was always undefined;
 *     5. its private gql() returned res.json() without inspecting `errors`, so
 *        all of the above reported { success: true }.
 *   It also watched np_todos.assigned_to_user_id and np_todos.status — neither
 *   column exists on staging or production. Assignment moved to np_todo_assignees
 *   in migration 015; the deprecated column was dropped.
 *
 * Why this does NOT write np_activity:
 *   migration 030 logs activity from a statement-level Postgres trigger, and its
 *   header explains why an event trigger is the wrong tool for an in-database
 *   audit log. Writing activity here too would double every row.
 *
 * Constraints:
 *   - `type` MUST be one of np_notifications_type_check: new_todo, due_reminder,
 *     shared_list, evening_reminder, location_reminder, list_update. There is no
 *     'task_assigned' member and adding one is a prod DDL change every client
 *     would then have to learn; 'new_todo' is the closest legal member and the
 *     title/body carry the real meaning.
 *   - Self-assignment notifies nobody.
 *   - Errors propagate. server.ts answers a failed event trigger with HTTP 200
 *     and { success: false } on purpose (Hasura would otherwise retry forever),
 *     and logs — but the failure is never swallowed inside the handler.
 *
 * SPORT: F08 backend functions — assignment notification.
 */

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';

/** Hasura event-trigger envelope, narrowed to what this handler reads. */
export interface AssigneeEvent {
  trigger?: { name: string };
  table?: { schema: string; name: string };
  event: {
    op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
    session_variables?: Record<string, string> | null;
    data: {
      old: Record<string, unknown> | null;
      new: Record<string, unknown> | null;
    };
  };
}

const FETCH_TODO = `
  query AssignedTodo($id: uuid!) {
    np_todos_by_pk(id: $id) { id title }
  }
`;

const CREATE_NOTIFICATION = `
  mutation CreateAssignmentNotification(
    $userId: uuid!, $title: String!, $body: String!, $data: jsonb!, $actionUrl: String!
  ) {
    insert_np_notifications_one(object: {
      user_id: $userId
      # MUST be a np_notifications_type_check member — see file header.
      type: "new_todo"
      title: $title
      body: $body
      data: $data
      action_url: $actionUrl
    }) { id }
  }
`;

/** Injectable so tests drive the handler without a Hasura instance. */
export type GqlFn = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const defaultGql: GqlFn = (query, variables) => adminGql(query, variables) as never;

export interface AssignmentResult {
  notified: boolean;
  reason?: 'no-row' | 'self-assignment' | 'no-assignee' | 'todo-missing';
}

export async function handleTodoAssigned(
  event: AssigneeEvent,
  gql: GqlFn = defaultGql,
): Promise<AssignmentResult> {
  try {
    const row = event?.event?.data?.new;
    if (!row) return { notified: false, reason: 'no-row' };

    const assigneeId = row['assignee_id'] as string | undefined;
    const todoId = row['todo_id'] as string | undefined;
    if (!assigneeId || !todoId) return { notified: false, reason: 'no-assignee' };

    // assigned_by is nullable (ON DELETE SET NULL) and can be absent for an
    // admin-side insert; fall back to the session actor before giving up.
    const actorId =
      (row['assigned_by'] as string | undefined) ??
      event.event.session_variables?.['x-hasura-user-id'];

    if (actorId && actorId === assigneeId) {
      return { notified: false, reason: 'self-assignment' };
    }

    const todoData = await gql<{ np_todos_by_pk: { id: string; title: string } | null }>(
      FETCH_TODO,
      { id: todoId },
    );
    const todo = todoData?.np_todos_by_pk;
    if (!todo) return { notified: false, reason: 'todo-missing' };

    await gql(CREATE_NOTIFICATION, {
      userId: assigneeId,
      title: 'Task assigned to you',
      body: todo.title,
      data: { todo_id: todo.id, assigned_by: actorId ?? null, kind: 'task_assigned' },
      actionUrl: `/tasks/${todo.id}`,
    });

    return { notified: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'todo-assigned' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}
