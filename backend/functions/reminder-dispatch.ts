/**
 * Purpose: Turn due np_reminders rows into np_notifications, then mark them sent.
 *
 * Inputs:  none — invoked by the Hasura cron trigger `dispatch-reminders`.
 * Outputs: { due, notified, failed } for the run.
 *
 * Why this exists:
 *   Reminders were storable on every surface and delivered on none. The cron
 *   fired every minute into a stub that only logged, so np_reminders rows
 *   accumulated and nothing ever read them. This closes that gap: it is the
 *   step between "a reminder exists" and "the user hears about it".
 *
 * Constraints:
 *   - Idempotent. `sent` is flipped in the same run, and the query only selects
 *     `sent: false`, so a cron overrun or a retry cannot notify twice. The cron
 *     runs every minute; a slow run overlapping the next one is normal.
 *   - Reminders for a COMPLETED todo are marked sent WITHOUT notifying. Nobody
 *     wants to be reminded about something they already finished, but leaving
 *     the row unsent would make it a permanent backlog item that is retried
 *     every minute forever.
 *   - A reminder whose todo has been deleted is marked sent and skipped: the
 *     row survives only if the FK did not cascade, and there is nothing to
 *     remind about.
 *   - Failure to notify one reminder must not abort the batch. Each is handled
 *     independently and the row is left unsent so the next run retries it.
 *   - Delivery to a device is notify-dispatch's job, driven off np_notifications.
 *     This handler deliberately stops at the notification row so there is one
 *     place that decides how a notification reaches a device.
 *
 * SPORT: F08 backend functions — reminder delivery.
 */

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';

/** Cap per run so a large backlog cannot build an unbounded batch. */
const MAX_PER_RUN = 200;

interface DueReminder {
  id: string;
  user_id: string;
  todo_id: string;
  remind_at: string;
  todo: { id: string; title: string; completed: boolean } | null;
}

const FETCH_DUE = `
  query DueReminders($now: timestamptz!, $limit: Int!) {
    np_reminders(
      where: { sent: { _eq: false }, remind_at: { _lte: $now } }
      order_by: { remind_at: asc }
      limit: $limit
    ) {
      id
      user_id
      todo_id
      remind_at
      todo { id title completed }
    }
  }
`;

const CREATE_NOTIFICATION = `
  mutation CreateReminderNotification(
    $userId: uuid!, $title: String!, $body: String!, $data: jsonb!
  ) {
    insert_np_notifications_one(object: {
      user_id: $userId
      # MUST be one of np_notifications_type_check: new_todo, due_reminder,
      # shared_list, evening_reminder, location_reminder, list_update.
      # "reminder" is NOT in that list and the insert is rejected outright.
      type: "due_reminder"
      title: $title
      body: $body
      data: $data
    }) { id }
  }
`;

const MARK_SENT = `
  mutation MarkReminderSent($id: uuid!, $sentAt: timestamptz!) {
    update_np_reminders_by_pk(
      pk_columns: { id: $id }
      _set: { sent: true, sent_at: $sentAt }
    ) { id }
  }
`;

export interface ReminderDispatchResult {
  due: number;
  notified: number;
  /** Left unsent on purpose so the next run retries them. */
  failed: number;
  /** Due, but intentionally not notified (completed or deleted todo). */
  skipped: number;
}

/** Injectable so tests can drive the handler without a Hasura instance. */
export type GqlFn = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const defaultGql: GqlFn = (query, variables) => adminGql(query, variables) as never;

export async function dispatchReminders(
  now: Date = new Date(),
  gql: GqlFn = defaultGql,
): Promise<ReminderDispatchResult> {
  const nowIso = now.toISOString();

  const data = await gql<{ np_reminders: DueReminder[] }>(FETCH_DUE, {
    now: nowIso,
    limit: MAX_PER_RUN,
  });
  const due = data?.np_reminders ?? [];

  let notified = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of due) {
    try {
      const todo = reminder.todo;

      // Nothing to remind about, but the row must not be retried forever.
      if (!todo || todo.completed) {
        await gql(MARK_SENT, { id: reminder.id, sentAt: nowIso });
        skipped += 1;
        continue;
      }

      await gql(CREATE_NOTIFICATION, {
        userId: reminder.user_id,
        title: 'Task reminder',
        body: todo.title,
        data: { todo_id: todo.id, reminder_id: reminder.id, kind: 'due_reminder' },
      });

      // Only after the notification exists. If this throws, the reminder stays
      // unsent and the next run retries — a duplicate notification is a far
      // smaller harm than a reminder that silently never arrives.
      await gql(MARK_SENT, { id: reminder.id, sentAt: nowIso });
      notified += 1;
    } catch (err) {
      failed += 1;
      Sentry.captureException(err, {
        tags: { handler: 'dispatch-reminders' },
        extra: { reminderId: reminder.id },
      });
    }
  }

  return { due: due.length, notified, failed, skipped };
}
