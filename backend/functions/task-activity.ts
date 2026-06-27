// T-0564: Hasura event trigger handler
// Triggered on app_todos INSERT and UPDATE (status/assigned_to/title/priority changes)
// Inserts an activity record and creates a notification for the assignee (if different from actor)

import { Sentry } from './sentry';

interface HasuraEvent {
  id: string;
  created_at: string;
  trigger: { name: string };
  table: { schema: string; name: string };
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
  data: {
    old: Record<string, unknown> | null;
    new: Record<string, unknown> | null;
  };
  session_variables: Record<string, string> | null;
}

const HASURA_URL = process.env.HASURA_GRAPHQL_URL || 'http://hasura:8080/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || '';

async function gql(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export async function handleTaskActivity(event: HasuraEvent): Promise<{ success: boolean }> {
  try {
    const task = event.data.new || event.data.old;
    if (!task) return { success: true };

    const actorId = event.session_variables?.['x-hasura-user-id'] || task['user_id'] as string;
    const action = event.op === 'INSERT' ? 'created' : 'updated';

    // Insert activity record
    await gql(
      `mutation LogActivity($todoId: uuid!, $actorId: uuid!, $action: String!, $meta: jsonb) {
        insert_app_activity_one(object: {
          todo_id: $todoId
          actor_id: $actorId
          action: $action
          metadata: $meta
        }) { id }
      }`,
      {
        todoId: task['id'],
        actorId,
        action,
        meta:
          event.op === 'UPDATE'
            ? { old: event.data.old, new: event.data.new }
            : null,
      },
    );

    // Notify assignee when task is newly assigned (and assignee ≠ actor)
    const newAssignee = event.data.new?.['assigned_to_user_id'] as string | undefined;
    const oldAssignee = event.data.old?.['assigned_to_user_id'] as string | undefined;
    if (newAssignee && newAssignee !== actorId && newAssignee !== oldAssignee) {
      await gql(
        `mutation Notify($userId: uuid!, $todoId: uuid!, $type: String!, $title: String!, $body: String!) {
          insert_app_notifications_one(object: {
            user_id: $userId
            todo_id: $todoId
            type: $type
            title: $title
            body: $body
          }) { id }
        }`,
        {
          userId: newAssignee,
          todoId: task['id'],
          type: 'task_assigned',
          title: 'Task assigned to you',
          body: `"${task['title']}" was assigned to you`,
        },
      );
    }

    return { success: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'task-activity' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}
