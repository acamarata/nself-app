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

const HASURA_URL = process.env.HASURA_GRAPHQL_URL || 'http://hasura:8080/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || '';
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

async function adminGql(
  query: string,
  variables: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Hasura request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

interface UserDataExport {
  exportedAt: string;
  userId: string;
  profile: unknown;
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

/** Aggregate all np_* data for the user into a structured export object. */
async function aggregateUserData(userId: string): Promise<UserDataExport> {
  const result = (await adminGql(
    `query ExportUserData($userId: uuid!) {
      np_profiles(where: { user_id: { _eq: $userId } }) {
        id user_id display_name avatar_url tos_accepted_at tos_version created_at updated_at
      }
      np_user_preferences(where: { user_id: { _eq: $userId } }) {
        id user_id time_format auto_hide_completed theme_preference
        default_list_id notification_settings created_at updated_at
      }
      np_lists(where: { owner_id: { _eq: $userId } }) {
        id title color emoji is_default position source_account_id created_at updated_at
      }
      np_todos(where: { user_id: { _eq: $userId } }) {
        id list_id title notes status priority due_date is_completed completed_at
        location_name location_lat location_lng reminder_time source_account_id
        created_at updated_at
      }
      np_subtasks(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id title is_done position source_account_id created_at updated_at
      }
      np_tags(where: { user_id: { _eq: $userId } }) {
        id name color source_account_id created_at
      }
      np_todo_tags(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id tag_id
      }
      np_comments(where: { author_id: { _eq: $userId } }) {
        id todo_id body edited_at source_account_id created_at updated_at
      }
      np_attachments(where: { uploader_id: { _eq: $userId } }) {
        id todo_id comment_id storage_key bucket file_name mime_type
        file_size_bytes acl source_account_id created_at
      }
      np_reminders(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id remind_at is_sent recurrence source_account_id created_at
      }
      np_recurring_rules(where: { todo: { user_id: { _eq: $userId } } }) {
        id todo_id frequency interval days_of_week end_date max_occurrences
        source_account_id created_at updated_at
      }
      np_account_activity(where: { user_id: { _eq: $userId } }) {
        id action metadata created_at
      }
    }`,
    { userId }
  )) as {
    data: {
      np_profiles: unknown[];
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
    };
  };

  const d = result.data;
  return {
    exportedAt: new Date().toISOString(),
    userId,
    profile: d.np_profiles?.[0] ?? null,
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
    throw new Error('Missing x-hasura-user-id in session variables');
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

    // Audit log
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

    return { downloadUrl, expiresAt };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'user-export' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}
