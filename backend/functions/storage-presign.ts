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

import { createHmac, createHash } from 'crypto';
import { Sentry } from './sentry';

// ── Env ────────────────────────────────────────────────────────────────────────
const HASURA_URL      = process.env.HASURA_GRAPHQL_URL     || 'http://hasura:8080/v1/graphql';
const ADMIN_SECRET    = process.env.HASURA_GRAPHQL_ADMIN_SECRET || '';
// Internal endpoint (Docker network) — used to validate the request and fetch metadata
const MINIO_ENDPOINT  = process.env.MINIO_ENDPOINT         || 'http://minio:9000';
// Public endpoint — returned to clients for presigned download URLs
const MINIO_ENDPOINT_PUBLIC = process.env.MINIO_ENDPOINT_PUBLIC || 'http://localhost:9000';
const MINIO_BUCKET    = process.env.MINIO_BUCKET            || 'ntask';
const ACCESS_KEY      = process.env.MINIO_ACCESS_KEY        || '';
const SECRET_KEY      = process.env.MINIO_SECRET_KEY        || '';
// MinIO region — 'us-east-1' is the default for MinIO regardless of geography
const AWS_REGION      = process.env.MINIO_REGION            || 'us-east-1';

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

// ── Admin GraphQL helper ───────────────────────────────────────────────────────

async function adminGql(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Hasura admin request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Hasura GQL error: ${json.errors.map((e) => e.message).join(', ')}`);
  }
  return json.data;
}

// ── AWS Signature V4 presign ───────────────────────────────────────────────────

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Generate an AWS Signature V4 presigned URL for MinIO.
 *
 * MinIO speaks S3 API v4. Presigned URLs embed the signature in query params
 * so the client can make an unsigned HTTP request that MinIO still validates.
 *
 * References:
 *   https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 *   https://min.io/docs/minio/linux/developers/javascript/API.html#presignedUrl
 */
function presignS3Url(opts: {
  method: 'PUT' | 'GET';
  endpoint: string;     // e.g. http://minio:9000 or http://localhost:9000
  bucket: string;
  objectKey: string;
  ttlSeconds: number;
  contentType?: string; // required for PUT
}): { url: string; expiresAt: string } {
  const { method, endpoint, bucket, objectKey, ttlSeconds, contentType } = opts;

  const now = new Date();
  // yyyyMMdd
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  // yyyyMMddTHHmmssZ
  const amzdate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');

  const service = 's3';
  const credentialScope = `${datestamp}/${AWS_REGION}/${service}/aws4_request`;
  const credential = `${ACCESS_KEY}/${credentialScope}`;

  // Build query parameters — must be sorted
  const queryParts: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzdate],
    ['X-Amz-Expires', String(ttlSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  if (contentType && method === 'PUT') {
    queryParts.push(['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD']);
  }
  queryParts.sort(([a], [b]) => a.localeCompare(b));

  const canonicalQueryString = queryParts
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Derive host from endpoint
  const endpointUrl = new URL(endpoint);
  const host = endpointUrl.host;

  // Canonical request
  const canonicalUri = `/${bucket}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzdate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Signing key: HMAC(HMAC(HMAC(HMAC("AWS4" + secretKey, date), region), service), "aws4_request")
  const kDate    = hmacSha256(`AWS4${SECRET_KEY}`, datestamp);
  const kRegion  = hmacSha256(kDate, AWS_REGION);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const signedQuery = `${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const url = `${endpoint}/${bucket}/${objectKey.split('/').map(encodeURIComponent).join('/')}?${signedQuery}`;

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  return { url, expiresAt };
}

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
  if (!userId) throw new Error('Missing x-hasura-user-id');

  const { fileName, mimeType, todoId } = payload.input as {
    fileName: string;
    mimeType: string;
    todoId: string;
  };

  if (!fileName || !mimeType || !todoId) {
    throw new Error('fileName, mimeType, and todoId are required');
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const err = Object.assign(new Error(`MIME type not allowed: ${mimeType}`), {
      extensions: { code: 'MIME_TYPE_NOT_ALLOWED', httpStatus: 422 },
    });
    throw err;
  }

  // Verify todoId belongs to the calling user
  const data = (await adminGql(
    `query VerifyTodoOwner($todoId: uuid!, $userId: uuid!) {
      np_todos_by_pk(id: $todoId) {
        id
        user_id
      }
    }`,
    { todoId, userId }
  )) as { np_todos_by_pk: { id: string; user_id: string } | null };

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
    endpoint: MINIO_ENDPOINT, // internal — client calls this from inside Docker network
    bucket: MINIO_BUCKET,
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
  if (!userId) throw new Error('Missing x-hasura-user-id');

  const { attachmentId } = payload.input as { attachmentId: string };
  if (!attachmentId) throw new Error('attachmentId is required');

  // Fetch attachment + access check via admin query
  const data = (await adminGql(
    `query FetchAttachment($attachmentId: uuid!) {
      np_attachments_by_pk(id: $attachmentId) {
        id
        storage_key
        bucket
        uploader_id
        todo {
          user_id
          list {
            list_shares(where: { accepted_at: { _is_null: false } }) {
              shared_with_user_id
            }
          }
        }
      }
    }`,
    { attachmentId }
  )) as {
    np_attachments_by_pk: {
      id: string;
      storage_key: string;
      bucket: string;
      uploader_id: string;
      todo: {
        user_id: string;
        list: {
          list_shares: Array<{ shared_with_user_id: string }>;
        } | null;
      } | null;
    } | null;
  };

  const attachment = data?.np_attachments_by_pk;
  if (!attachment) {
    throw Object.assign(new Error('Attachment not found'), {
      extensions: { code: 'ATTACHMENT_NOT_FOUND', httpStatus: 404 },
    });
  }

  // Access check: uploader OR todo owner OR list member
  const isUploader  = attachment.uploader_id === userId;
  const isTodoOwner = attachment.todo?.user_id === userId;
  const isListMember = attachment.todo?.list?.list_shares?.some(
    (s) => s.shared_with_user_id === userId
  ) ?? false;

  if (!isUploader && !isTodoOwner && !isListMember) {
    throw Object.assign(new Error('Not authorised'), {
      extensions: { code: 'UNAUTHORISED', httpStatus: 403 },
    });
  }

  // Prefer the attachment's own bucket; fall back to env default
  const bucket = attachment.bucket || MINIO_BUCKET;

  // Return presigned GET URL via the public endpoint (reachable by clients)
  const { url: downloadUrl, expiresAt } = presignS3Url({
    method: 'GET',
    endpoint: MINIO_ENDPOINT_PUBLIC,
    bucket,
    objectKey: attachment.storage_key,
    ttlSeconds: DOWNLOAD_TTL_SECONDS,
  });

  return { downloadUrl, expiresAt };
}
