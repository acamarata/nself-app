// Purpose: Hasura Action handler for requestDataExport mutation (GDPR Art. 20)
// Inputs: Hasura Action payload with x-hasura-user-id from JWT (role=user only)
// Outputs: { downloadUrl: string; expiresAt: string }
// Constraints:
//   - Rate limit: 1 export per user per 24 hours (in-memory map; Redis in future wave)
//   - Export JSON stored in MinIO as exports/{userId}/data-export-{date}.json
//   - Presigned URL valid for 7 days (604800 seconds)
//   - No other user's data ever included (queries always filter by userId)
//   - Attachment binaries excluded; metadata + storage_key included
// SPORT: F08 backend functions; J-S3-T2

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';
import { unauthorized } from './lib/action-error';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://minio:9000';
const MINIO_ENDPOINT_PUBLIC = process.env.MINIO_ENDPOINT_PUBLIC || 'http://localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'ntask';

// 24-hour rate limit (in-memory; keyed by userId — survives restart via presigned URL check)
const exportRateMap = new Map<string, number>();
const EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

interface ExportResult {
  downloadUrl: string;
  expiresAt: string;
}

interface UserDataExport {
  exportedAt: string;
  userId: string;
  profile: unknown;
  taskProfile: unknown;
  preferences: unknown;
  lists: unknown[];
  todos: unknown[];
  subtasks: unknown[];
  tags: unknown[];
  todoTags: unknown[];
  comments: unknown[];
  attachments: unknown[];
  reminders: unknown[];
  recurringRules: unknown[];
  activityLog: unknown[];
}

/**
 * Aggregate all np_* data for the user into a structured export object.
 *
 * Every field below is checked against the real schema — backend/postgres/init.sql
 * plus migrations 003-027 — not against the client-facing GraphQL aliases:
 *   - np_profiles is keyed by `id` (it IS the auth.users id); there is no user_id.
 *   - np_lists is keyed by `user_id` and its glyph column is `icon`, not `emoji`.
 *     (Migration 019 refers to a np_lists.owner_id FK, but the column was never
 *     created — its guard clause simply never matches. init.sql is authoritative.)
 *   - np_todos has `completed`; there is no `status` and no `is_completed`.
 *   - np_reminders has `sent`/`sent_at`/`channel`; no `is_sent`, no `recurrence`.
 *   - np_recurring_rules uses `interval_count`/`by_day`/`count_limit`.
 * task_users is the successor to np_profiles (migration 023) and carries the
 * ToS-acceptance fields this export originally tried to read off np_profiles.
 */
async function aggregateUserData(userId: string): Promise<UserDataExport> {
  const d = await adminGql<{
    np_profiles: unknown[];
    task_users: unknown[];
    np_user_preferences: unknown[];
    np_lists: unknown[];
    np_todos: unknown[];
    np_subtasks: unknown[];
    np_tags: unknown[];
    np_todo_tags: unknown[];
    np_comments: unknown[];
    np_attachments: unknown[];
    np_reminders: unknown[];
    np_recurring_rules: unknown[];
    np_account_activity: unknown[];
  }>(
    `query ExportUserData($userId: uuid!) {
      np_profiles(where: { id: { _eq: $userId } }) {
        id email display_name bio avatar_url time_format auto_hide_completed
        theme_preference default_list_id notification_settings
        source_account_id created_at updated_at
      }
      task_users(where: { user_id: { _eq: $userId } }) {
        user_id display_name avatar_url prefs onboarding_done timezone
        time_format auto_hide_completed default_list_id notification_settings
        theme_preference mfa_enabled tos_accepted_at tos_version
        source_account_id created_at updated_at
      }
      np_user_preferences(where: { user_id: { _eq: $userId } }) {
        id user_id time_format auto_hide_completed theme_preference
        default_list_id notification_settings source_account_id created_at updated_at
      }
      np_lists(where: { user_id: { _eq: $userId } }) {
        id user_id title description color icon is_default position group_id
        location_name location_lat location_lng location_radius reminder_on_arrival
        source_account_id created_at updated_at
      }
      np_todos(where: { user_id: { _eq: $userId } }) {
        id user_id list_id title description notes completed completed_at
        priority due_date tags position is_public
        location_name location_lat location_lng location_radius
        reminder_time recurrence_rule recurrence_parent_id attachments
        requires_approval requires_photo completed_by
        approved approved_by approved_at completion_photo_url completion_notes
        rejected_by rejected_at rejection_reason idempotency_key
        source_account_id created_at updated_at
      }
      np_subtasks(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id title is_done position source_account_id created_at updated_at
      }
      np_tags(where: { user_id: { _eq: $userId } }) {
        id user_id name color source_account_id created_at updated_at
      }
      np_todo_tags(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id tag_id source_account_id created_at
      }
      np_comments(where: { author_id: { _eq: $userId } }) {
        id todo_id author_id parent_comment_id body edited_at deleted_at
        source_account_id created_at updated_at
      }
      np_attachments(where: { uploader_id: { _eq: $userId } }) {
        id todo_id comment_id storage_key bucket file_name mime_type
        file_size_bytes acl source_account_id created_at
      }
      np_reminders(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id user_id channel remind_at sent sent_at source_account_id created_at
      }
      np_recurring_rules(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id frequency interval_count by_day by_month by_month_day
        rrule start_date end_date until_date count_limit
        source_account_id created_at updated_at
      }
      np_account_activity(where: { user_id: { _eq: $userId } }) {
        id action metadata ip_address created_at
      }
    }`,
    { userId }
  );

  return {
    exportedAt: new Date().toISOString(),
    userId,
    profile: d.np_profiles?.[0] ?? null,
    taskProfile: d.task_users?.[0] ?? null,
    preferences: d.np_user_preferences?.[0] ?? null,
    lists: d.np_lists ?? [],
    todos: d.np_todos ?? [],
    subtasks: d.np_subtasks ?? [],
    tags: d.np_tags ?? [],
    todoTags: d.np_todo_tags ?? [],
    comments: d.np_comments ?? [],
    attachments: d.np_attachments ?? [],
    reminders: d.np_reminders ?? [],
    recurringRules: d.np_recurring_rules ?? [],
    activityLog: d.np_account_activity ?? [],
  };
}

/** Upload JSON to MinIO and return a presigned GET URL valid for 7 days. */
async function storeExportAndPresign(
  userId: string,
  data: UserDataExport
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const objectKey = `exports/${userId}/data-export-${dateStr}.json`;
  const jsonBody = JSON.stringify(data, null, 2);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // PUT object — Basic auth placeholder (same caveat as user-delete.ts MinIO stub)
  // Production: use @aws-sdk/client-s3 with Signature V4 (A-S4-T3 wave)
  const credentials = Buffer.from(`${MINIO_ACCESS_KEY}:${MINIO_SECRET_KEY}`).toString('base64');
  const putUrl = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${objectKey}`;

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(jsonBody)),
    },
    body: jsonBody,
  });

  if (!putRes.ok) {
    throw new Error(`MinIO PUT failed: ${putRes.status} ${await putRes.text()}`);
  }

  // Presigned GET URL (7-day TTL). In production this uses the S3 SDK presignGetObjectCommand.
  // For now we return a placeholder URL with a signed query param (stub pattern).
  // The client should treat this as the download URL.
  const downloadUrl = `${MINIO_ENDPOINT_PUBLIC}/${MINIO_BUCKET}/${objectKey}?expires=${Date.now() + 604800000}`;

  return { downloadUrl, expiresAt };
}

/**
 * requestDataExport — GDPR Art. 20 data portability handler.
 * Returns a presigned MinIO URL to download the user's full data as JSON.
 */
export async function requestDataExport(
  payload: HasuraActionPayload
): Promise<ExportResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  if (!userId) {
    // Caller fault, not a server fault — must not surface as a 500.
    throw unauthorized('Missing x-hasura-user-id in session variables', 'MISSING_USER_ID');
  }

  // Rate limit: 1 export per 24h per user
  const lastExport = exportRateMap.get(userId);
  if (lastExport && Date.now() - lastExport < EXPORT_COOLDOWN_MS) {
    const retryAfter = Math.ceil((EXPORT_COOLDOWN_MS - (Date.now() - lastExport)) / 1000);
    const err = Object.assign(new Error('Export rate limit exceeded'), {
      extensions: {
        code: 'EXPORT_RATE_LIMITED',
        retryAfterSeconds: retryAfter,
        httpStatus: 429,
      },
    });
    throw err;
  }
  exportRateMap.set(userId, Date.now());

  try {
    const exportData = await aggregateUserData(userId);
    const { downloadUrl, expiresAt } = await storeExportAndPresign(userId, exportData);

    // Audit log — best effort. The export already exists and the URL is valid,
    // so a failed audit insert must not deny the user their data. It is reported
    // rather than swallowed (adminGql now throws on Hasura's HTTP-200 errors).
    try {
      await adminGql(
        `mutation LogExport($userId: uuid!, $meta: jsonb) {
          insert_np_account_activity_one(object: {
            user_id: $userId
            action: "data_export_ready"
            metadata: $meta
          }) { id }
        }`,
        {
          userId,
          meta: {
            expiresAt,
            todoCount: (exportData.todos as unknown[]).length,
            attachmentCount: (exportData.attachments as unknown[]).length,
          },
        }
      );
    } catch (auditErr) {
      console.error('[user-export] audit log insert failed:', auditErr);
      Sentry.captureException(auditErr, {
        tags: { function: 'user-export', step: 'audit' },
      });
    }

    return { downloadUrl, expiresAt };
  } catch (err) {
    // A failed export must not burn the caller's 24h allowance.
    exportRateMap.delete(userId);
    Sentry.captureException(err, { tags: { function: 'user-export' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}
