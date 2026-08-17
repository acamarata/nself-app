// Purpose: Hasura Action handlers for MinIO presigned URL generation
//   getUploadUrl  — returns a presigned PUT URL for direct client-to-MinIO upload
//   getDownloadUrl — returns a presigned GET URL for an existing attachment
//
// Inputs:
//   getUploadUrl(fileName, mimeType, todoId): { uploadUrl, storagePath, expiresAt }
//   getDownloadUrl(attachmentId): { downloadUrl, expiresAt }
//
// Outputs:
//   Presigned URLs signed with AWS Signature V4 (HMAC-SHA256).
//   The upload URL is a direct PUT to MinIO — client uploads binary, then calls
//   insertAttachment mutation with the storagePath.
//   The download URL is a presigned GET valid for DOWNLOAD_TTL_SECONDS.
//
// Constraints:
//   - SigV4 signing only (no Basic auth). MinIO fully supports AWS SigV4.
//   - Upload TTL: 15 minutes (900s). Download TTL: 1 hour (3600s).
//   - File size checked via mimeType allowlist; byte-size enforced by RLS (≤100MB).
//   - todoId must belong to the calling user (enforced by admin query).
//   - attachmentId must be accessible to calling user (enforced by admin select).
//   - storagePath format: attachments/{userId}/{todoId}/{uuid}-{sanitisedFileName}
//
// SPORT: F08 backend functions; P5-W5-storage-presign

import { Sentry } from './sentry';
import { adminGql } from './lib/admin-gql';
import { badRequest, unauthorized } from './lib/action-error';
import {
  presignS3Url,
  minioEndpoint,
  minioPublicEndpoint,
  minioBucket,
} from './lib/s3-presign';

// ── Env ────────────────────────────────────────────────────────────────────────
// Endpoints/bucket/credentials all resolve through lib/s3-presign so this handler,
// user-export and user-delete cannot drift apart. Read at call time, not load time.

const UPLOAD_TTL_SECONDS   = 900;   // 15 minutes
const DOWNLOAD_TTL_SECONDS = 3600;  // 1 hour
const MAX_FILE_SIZE_BYTES  = 104_857_600; // 100 MiB — must match RLS CHECK

// ── Allowed MIME types ─────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain', 'text/csv', 'text/markdown',
  // Archives
  'application/zip', 'application/x-zip-compressed',
  // Audio/Video
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'video/mp4', 'video/webm', 'video/ogg',
]);

// ── Shared types ───────────────────────────────────────────────────────────────

interface HasuraActionPayload {
  action: { name: string };
  session_variables: Record<string, string>;
  input: Record<string, unknown>;
}

interface UploadUrlResult {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

interface DownloadUrlResult {
  downloadUrl: string;
  expiresAt: string;
}

// Admin GraphQL access comes from lib/admin-gql (shared by every handler).


// ── UUID helper ────────────────────────────────────────────────────────────────

function randomUuid(): string {
  // Use crypto.randomUUID if available (Node 19+), else polyfill
  if (typeof (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID === 'function') {
    return (globalThis as unknown as { crypto: { randomUUID: () => string } }).crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Sanitise a filename to safe URL path characters. */
function sanitiseFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/__+/g, '_')
    .slice(0, 200);
}

// ── getUploadUrl handler ───────────────────────────────────────────────────────

/**
 * getUploadUrl — Hasura Action handler
 *
 * 1. Validates todoId belongs to the calling user (admin query).
 * 2. Validates mimeType is in allowlist.
 * 3. Generates a unique storagePath.
 * 4. Returns a presigned S3 PUT URL (SigV4) valid 15 minutes.
 *
 * After upload the client must call:
 *   insertAttachment(todoId, storagePath, fileName, mimeType, fileSizeBytes)
 * to persist the np_attachments row.
 */
export async function getUploadUrl(
  payload: HasuraActionPayload
): Promise<UploadUrlResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  if (!userId) {
    throw unauthorized('Missing x-hasura-user-id', 'MISSING_USER_ID');
  }

  const { fileName, mimeType, todoId } = payload.input as {
    fileName: string;
    mimeType: string;
    todoId: string;
  };

  if (!fileName || !mimeType || !todoId) {
    throw badRequest('fileName, mimeType, and todoId are required', 'MISSING_INPUT');
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const err = Object.assign(new Error(`MIME type not allowed: ${mimeType}`), {
      extensions: { code: 'MIME_TYPE_NOT_ALLOWED', httpStatus: 422 },
    });
    throw err;
  }

  // Verify todoId belongs to the calling user
  const data = await adminGql<{ np_todos_by_pk: { id: string; user_id: string } | null }>(
    `query VerifyTodoOwner($todoId: uuid!, $userId: uuid!) {
      np_todos_by_pk(id: $todoId) {
        id
        user_id
      }
    }`,
    { todoId, userId }
  );

  const todo = data?.np_todos_by_pk;
  if (!todo) {
    throw Object.assign(new Error('Todo not found'), {
      extensions: { code: 'TODO_NOT_FOUND', httpStatus: 404 },
    });
  }
  if (todo.user_id !== userId) {
    throw Object.assign(new Error('Not authorised'), {
      extensions: { code: 'UNAUTHORISED', httpStatus: 403 },
    });
  }

  // Build storage path: attachments/{userId}/{todoId}/{uuid}-{sanitisedName}
  const uniqueId = randomUuid();
  const safeFileName = sanitiseFileName(fileName);
  const storagePath = `attachments/${userId}/${todoId}/${uniqueId}-${safeFileName}`;

  const { url: uploadUrl, expiresAt } = presignS3Url({
    method: 'PUT',
    endpoint: minioEndpoint(), // internal — client calls this from inside Docker network
    bucket: minioBucket(),
    objectKey: storagePath,
    ttlSeconds: UPLOAD_TTL_SECONDS,
    contentType: mimeType,
  });

  return { uploadUrl, storagePath, expiresAt };
}

// ── getDownloadUrl handler ─────────────────────────────────────────────────────

/**
 * getDownloadUrl — Hasura Action handler
 *
 * 1. Looks up the attachment by ID (admin query), verifying the calling user
 *    has read access (is uploader, or is todo owner, or is list member).
 * 2. Returns a presigned S3 GET URL (SigV4) valid 1 hour using the public endpoint.
 */
export async function getDownloadUrl(
  payload: HasuraActionPayload
): Promise<DownloadUrlResult> {
  const userId = payload.session_variables['x-hasura-user-id'];
  if (!userId) {
    throw unauthorized('Missing x-hasura-user-id', 'MISSING_USER_ID');
  }

  const { attachmentId } = payload.input as { attachmentId: string };
  if (!attachmentId) throw badRequest('attachmentId is required', 'MISSING_ATTACHMENT_ID');

  // Fetch attachment + access check via admin query
  // `shares` is the array relationship np_lists -> np_list_shares (metadata
  // databases/default/tables/tables.yaml). It was previously spelled
  // `list_shares`, which no relationship answers to — the query was rejected.
  const data = await adminGql<{
    np_attachments_by_pk: {
      id: string;
      storage_key: string;
      bucket: string;
      uploader_id: string;
      todo: {
        user_id: string;
        list: {
          shares: Array<{ shared_with_user_id: string | null }>;
        } | null;
      } | null;
    } | null;
  }>(
    `query FetchAttachment($attachmentId: uuid!) {
      np_attachments_by_pk(id: $attachmentId) {
        id
        storage_key
        bucket
        uploader_id
        todo {
          user_id
          list {
            shares(where: { accepted_at: { _is_null: false } }) {
              shared_with_user_id
            }
          }
        }
      }
    }`,
    { attachmentId }
  );

  const attachment = data?.np_attachments_by_pk;
  if (!attachment) {
    throw Object.assign(new Error('Attachment not found'), {
      extensions: { code: 'ATTACHMENT_NOT_FOUND', httpStatus: 404 },
    });
  }

  // Access check: uploader OR todo owner OR list member
  const isUploader  = attachment.uploader_id === userId;
  const isTodoOwner = attachment.todo?.user_id === userId;
  const isListMember = attachment.todo?.list?.shares?.some(
    (s) => s.shared_with_user_id === userId
  ) ?? false;

  if (!isUploader && !isTodoOwner && !isListMember) {
    throw Object.assign(new Error('Not authorised'), {
      extensions: { code: 'UNAUTHORISED', httpStatus: 403 },
    });
  }

  // Prefer the attachment's own bucket; fall back to env default
  const bucket = attachment.bucket || minioBucket();

  // Return presigned GET URL via the public endpoint (reachable by clients)
  const { url: downloadUrl, expiresAt } = presignS3Url({
    method: 'GET',
    endpoint: minioPublicEndpoint(),
    bucket,
    objectKey: attachment.storage_key,
    ttlSeconds: DOWNLOAD_TTL_SECONDS,
  });

  return { downloadUrl, expiresAt };
}
