/**
 * Purpose: Once a day, give each user one in-app notification summarising the
 *   tasks they have due tomorrow.
 *
 * Inputs:  none — invoked by the Hasura cron trigger `ntask_evening_digest`.
 * Outputs: { users, notified, skipped, failed } for the run.
 *
 * Why this exists:
 *   FEATURES.md and the public wiki advertised a daily 8 PM digest of tomorrow's
 *   tasks. Nothing implemented it: no cron, no handler, no client code — the
 *   only trace in the repo was the `evening_reminder` value in a comment. The
 *   2026-08-24 review offered "retract the claim" or "build it"; D-CR24-DOCS
 *   chose to build it, because it is one cron plus one handler on the same path
 *   reminder-dispatch already proved.
 *
 * Constraints:
 *   - Idempotent per user per UTC day. The cron's tolerance window means a
 *     delayed run can fire late, and a retry must not send a second digest, so
 *     each user is skipped when they already have an evening_reminder row dated
 *     today. Two digests in one evening is worse than none.
 *   - `type` MUST be `evening_reminder` — a np_notifications_type_check member.
 *   - Users with in-app notifications turned off are skipped. The stored shape
 *     is { push, email, inApp } (see @nself/ntask-core NotificationSettings);
 *     absent means on, because the column default predates the setting.
 *   - Schedule is 20:00 UTC in v1. Per-user local-time delivery needs a
 *     per-user schedule or an hourly sweep keyed on the user's timezone, and
 *     np_user_preferences has no timezone column yet — see the note on the cron
 *     trigger in backend/hasura/metadata/cron_triggers.yaml.
 *   - One failing user must not abort the batch.
 *
 * SPORT: F08 backend functions — evening digest.
 */

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';

/** Titles listed in the body before it degrades to a bare count. */
const MAX_TITLES = 3;

/** Cap per run so a large user base cannot build an unbounded batch. */
const MAX_USERS = 500;

interface DueTodo {
  id: string;
  user_id: string;
  title: string;
}

const FETCH_DUE_TOMORROW = `
  query TodosDueTomorrow($from: timestamptz!, $to: timestamptz!, $limit: Int!) {
    np_todos(
      where: {
        completed: { _eq: false }
        due_date: { _gte: $from, _lt: $to }
      }
      order_by: { due_date: asc }
      limit: $limit
    ) {
      id
      user_id
      title
    }
  }
`;

const FETCH_STATE = `
  query DigestState($userIds: [uuid!]!, $since: timestamptz!) {
    np_user_preferences(where: { user_id: { _in: $userIds } }) {
      user_id
      notification_settings
    }
    np_notifications(
      where: {
        user_id: { _in: $userIds }
        type: { _eq: "evening_reminder" }
        created_at: { _gte: $since }
      }
    ) {
      user_id
    }
  }
`;

const CREATE_DIGEST = `
  mutation CreateEveningDigest($userId: uuid!, $title: String!, $body: String!, $data: jsonb!) {
    insert_np_notifications_one(object: {
      user_id: $userId
      # MUST be a np_notifications_type_check member: new_todo, due_reminder,
      # shared_list, evening_reminder, location_reminder, list_update.
      type: "evening_reminder"
      title: $title
      body: $body
      data: $data
    }) { id }
  }
`;

export interface DigestResult {
  /** Users with at least one incomplete task due tomorrow. */
  users: number;
  notified: number;
  /** Already digested today, or in-app notifications turned off. */
  skipped: number;
  failed: number;
}

/** Injectable so tests drive the handler without a Hasura instance. */
export type GqlFn = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const defaultGql: GqlFn = (query, variables) => adminGql(query, variables) as never;

/** Midnight UTC of the day `offset` days from `now`. */
function utcDayStart(now: Date, offset: number): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, 0, 0, 0, 0,
  ));
}

function buildBody(titles: string[]): string {
  const shown = titles.slice(0, MAX_TITLES);
  const rest = titles.length - shown.length;
  const list = shown.join(', ');
  return rest > 0 ? `${list} and ${rest} more` : list;
}

export async function runEveningDigest(
  now: Date = new Date(),
  gql: GqlFn = defaultGql,
): Promise<DigestResult> {
  const from = utcDayStart(now, 1);
  const to = utcDayStart(now, 2);
  const todayStart = utcDayStart(now, 0);

  const due = await gql<{ np_todos: DueTodo[] }>(FETCH_DUE_TOMORROW, {
    from: from.toISOString(),
    to: to.toISOString(),
    limit: MAX_USERS * 20,
  });

  const byUser = new Map<string, string[]>();
  for (const todo of due?.np_todos ?? []) {
    const titles = byUser.get(todo.user_id) ?? [];
    titles.push(todo.title);
    byUser.set(todo.user_id, titles);
  }

  const userIds = [...byUser.keys()].slice(0, MAX_USERS);
  if (userIds.length === 0) {
    return { users: 0, notified: 0, skipped: 0, failed: 0 };
  }

  const state = await gql<{
    np_user_preferences: Array<{ user_id: string; notification_settings: unknown }>;
    np_notifications: Array<{ user_id: string }>;
  }>(FETCH_STATE, { userIds, since: todayStart.toISOString() });

  const alreadySent = new Set((state?.np_notifications ?? []).map((n) => n.user_id));
  const inAppOff = new Set(
    (state?.np_user_preferences ?? [])
      .filter((p) => {
        const s = p.notification_settings as { inApp?: boolean } | null;
        return s !== null && typeof s === 'object' && s.inApp === false;
      })
      .map((p) => p.user_id),
  );

  let notified = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    if (alreadySent.has(userId) || inAppOff.has(userId)) {
      skipped += 1;
      continue;
    }
    const titles = byUser.get(userId) ?? [];
    try {
      await gql(CREATE_DIGEST, {
        userId,
        title: titles.length === 1
          ? '1 task due tomorrow'
          : `${titles.length} tasks due tomorrow`,
        body: buildBody(titles),
        data: { kind: 'evening_digest', count: titles.length, for_date: from.toISOString().slice(0, 10) },
      });
      notified += 1;
    } catch (err) {
      failed += 1;
      Sentry.captureException(err, {
        tags: { handler: 'evening-digest' },
        extra: { userId },
      });
    }
  }

  return { users: userIds.length, notified, skipped, failed };
}
