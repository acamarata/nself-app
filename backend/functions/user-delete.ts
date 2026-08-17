// Purpose: Hasura Action handler for deleteMyAccount mutation
// Inputs: Hasura Action payload with x-hasura-user-id from JWT (role=user only)
// Outputs: { success: boolean; deletedAt: string }
// Constraints:
//   - HASURA_AUTH_ADMIN_SECRET never sent to client (server-side env only)
//   - Idempotent: calling after deletion returns success (user already gone)
//   - Cascade order: MinIO objects → np_* rows → auth.users row
//   - The auth.users delete is VERIFIED by re-reading the row, not by a status
//     code. Reporting success while the login credential survives is the worst
//     possible outcome for this action.
//   - Logs audit record to np_account_activity before deleting user
// SPORT: F08 backend functions; J-S3-T1

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';
import { unauthorized } from './lib/action-error';
import { presignS3Url, minioEndpoint, minioBucket } from './lib/s3-presign';

const OBJECT_DELETE_TTL_SECONDS = 300;

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

interface DeleteAccountResult {
  success: boolean;
  deletedAt: string;
}

/** Fetch all MinIO storage_key values owned by the user before deletion. */
async function fetchAttachmentKeys(userId: string): Promise<string[]> {
  const data = await adminGql<{
    np_attachments: Array<{ storage_key: string; bucket: string }>;
  }>(
    `query GetAttachments($userId: uuid!) {
      np_attachments(where: { uploader_id: { _eq: $userId } }) {
        storage_key
        bucket
      }
    }`,
    { userId }
  );
  return data.np_attachments?.map((a) => a.storage_key) ?? [];
}

/**
 * Delete a single MinIO object.
 *
 * Signed with SigV4 via lib/s3-presign. The previous implementation sent an HTTP
 * `Authorization: Basic` header, which MinIO rejects outright — so this step
 * always failed, and (being non-fatal below) the failure was only ever logged.
 * Objects were left behind on every account deletion.
 */
async function deleteMinioObject(storageKey: string): Promise<void> {
  const { url } = presignS3Url({
    method: 'DELETE',
    endpoint: minioEndpoint(),
    bucket: minioBucket(),
    objectKey: storageKey,
    ttlSeconds: OBJECT_DELETE_TTL_SECONDS,
  });

  const res = await fetch(url, { method: 'DELETE' });
  // 200/204 = deleted, 404 = already gone (idempotent)
  if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
    throw new Error(`MinIO delete failed for key ${storageKey}: ${res.status}`);
  }
}

/**
 * Write an audit record to np_account_activity (admin insert bypasses RLS).
 * Deliberately fatal: this records the intent to destroy data BEFORE anything is
 * destroyed, so a failure here must abort the deletion rather than proceed unlogged.
 */
async function logAccountActivity(
  userId: string,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await adminGql(
    `mutation LogAccountActivity($userId: uuid!, $action: String!, $meta: jsonb) {
      insert_np_account_activity_one(object: {
        user_id: $userId
        action: $action
        metadata: $meta
      }) { id }
    }`,
    { userId, action, meta: metadata }
  );
}

/**
 * Delete the auth.users row — the step that actually terminates the account.
 *
 * WHY NOT hasura-auth: `DELETE /users/{id}` does not exist in nhost/hasura-auth
 * 0.36.0 (probed 2026-08-16: 404 "route-not-found"). The old implementation called
 * it AND treated 404 as "already gone", so the final step of every account
 * deletion silently no-opped while the action still answered success: the login
 * credential survived a "deleted" account indefinitely.
 *
 * auth.users is tracked in Hasura, so the admin client deletes the row directly.
 * Every np_ table and task_users references auth.users(id) ON DELETE CASCADE, so
 * this also sweeps anything the explicit deletes above missed.
 *
 * Idempotent by RE-READING, not by trusting a status code: if the row is absent
 * afterwards the account is gone regardless of who deleted it, and if it is still
 * present this throws rather than reporting a successful deletion.
 */
async function deleteAuthUser(userId: string): Promise<void> {
  // Root fields are hasura-auth's own: `deleteUsers` and `user` (select_by_pk).
  // hasura-auth re-applies that configuration to the auth schema on every startup.
  await adminGql(
    `mutation DeleteAuthUser($userId: uuid!) {
      deleteUsers(where: { id: { _eq: $userId } }) { affected_rows }
    }`,
    { userId }
  );

  const check = await adminGql<{ user: { id: string } | null }>(
    `query VerifyAuthUserGone($userId: uuid!) { user(id: $userId) { id } }`,
    { userId }
  );

  if (check.user) {
    throw new Error(
      `auth.users row for ${userId} still present after delete — account NOT deleted`
    );
  }
}

/**
 * deleteAccount — hard-deletes all data for the requesting user.
 *
 * Cascade order (explicit, not relying solely on FK cascade for MinIO):
 *   1. Fetch attachment storage keys (before np_* rows are gone)
 *   2. Log audit entry
 *   3. Delete MinIO objects
 *   4. Delete np_* rows (explicit, FK cascade handles children)
 *   5. Delete auth.users row via hasura-auth admin API
 */
export async function deleteAccount(
  payload: HasuraActionPayload
): Promise<DeleteAccountResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  if (!userId) {
    // Caller fault, not a server fault — must not surface as a 500.
    throw unauthorized('Missing x-hasura-user-id in session variables', 'MISSING_USER_ID');
  }

  try {
    // Step 1: collect MinIO objects before any row deletions
    const storageKeys = await fetchAttachmentKeys(userId);

    // Step 2: audit log — intent recorded before destructive ops
    await logAccountActivity(userId, 'account_delete_requested', {
      attachmentCount: storageKeys.length,
      requestedAt: new Date().toISOString(),
    });

    // Step 3: delete MinIO objects (idempotent on 404)
    const minioErrors: string[] = [];
    for (const key of storageKeys) {
      try {
        await deleteMinioObject(key);
      } catch (err) {
        // Non-fatal: log and continue. DB rows still purged.
        minioErrors.push(String(err));
        Sentry.captureException(err, {
          tags: { function: 'user-delete', step: 'minio' },
          extra: { storageKey: key },
        });
      }
    }

    // Step 4: delete np_* rows explicitly in dependency order.
    // FK CASCADE handles children (subtasks, comments, etc.) automatically.
    // We delete root-level rows; child tables cascade.
    await adminGql(
      `mutation DeleteUserData(
        $userId: uuid!
      ) {
        # Root-level tables that own data for this user.
        # Children (np_subtasks, np_comments, np_attachments, np_tags, np_todo_tags,
        #   np_reminders, np_recurring_rules, np_recurring_instances, np_activity,
        #   np_notifications, np_todo_assignees, np_todo_shares, np_list_members,
        #   np_list_presence, np_list_shares) are deleted via ON DELETE CASCADE.
        delete_np_offline_outbox(where: { user_id: { _eq: $userId } }) { affected_rows }
        delete_np_device_tokens(where: { user_id: { _eq: $userId } }) { affected_rows }
        delete_np_user_preferences(where: { user_id: { _eq: $userId } }) { affected_rows }
        #
        # Column names below are checked against backend/postgres/init.sql:
        #   np_lists is keyed by user_id (there is no owner_id column — migration
        #   019's np_lists_owner_id_fkey guard never matches), and np_profiles's
        #   PK column id IS the auth.users id (there is no user_id column).
        delete_np_todos(where: { user_id: { _eq: $userId } }) { affected_rows }
        delete_np_lists(where: { user_id: { _eq: $userId } }) { affected_rows }
        delete_np_tags(where: { user_id: { _eq: $userId } }) { affected_rows }
        delete_task_users(where: { user_id: { _eq: $userId } }) { affected_rows }
        delete_np_profiles(where: { id: { _eq: $userId } }) { affected_rows }
      }`,
      { userId }
    );

    const deletedAt = new Date().toISOString();

    // Step 5: delete from auth.users (terminates all sessions)
    await deleteAuthUser(userId);

    return { success: true, deletedAt };
  } catch (err) {
    Sentry.captureException(err, { tags: { function: 'user-delete' } });
    throw err;
  } finally {
    await Sentry.flush(2000);
  }
}
