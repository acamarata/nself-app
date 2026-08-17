// Purpose: The single AWS Signature V4 presigner used by every handler that has
//   to reach MinIO (storage-presign, user-export, user-delete).
//
// Inputs:  method/bucket/objectKey/ttl plus MinIO credentials from the environment.
// Outputs: { url, expiresAt } — a URL any HTTP client can call unsigned.
//
// Constraints:
//   - THE reason this module exists: user-export.ts and user-delete.ts each
//     reached MinIO with an HTTP `Authorization: Basic <access>:<secret>` header.
//     MinIO speaks S3 and rejects Basic auth outright, so the GDPR export upload
//     and the account-deletion object purge could never have succeeded. Both now
//     use the same signer storage-presign.ts already had.
//   - Env is read at call time, not module load, so a handler imported before the
//     environment is populated still signs with the right credentials.
//   - Presigned URLs carry the credential in the query string: never log one, and
//     only ever hand the PUBLIC-endpoint variant to a client.
//
// SPORT: F08 backend functions

import { createHmac, createHash } from 'crypto';

/** Internal (Docker network) MinIO endpoint — server-to-server calls. */
export function minioEndpoint(): string {
  return process.env['MINIO_ENDPOINT'] || 'http://minio:9000';
}

/** Public MinIO endpoint — the only one safe to hand to a client. */
export function minioPublicEndpoint(): string {
  return process.env['MINIO_ENDPOINT_PUBLIC'] || 'http://localhost:9000';
}

export function minioBucket(): string {
  return process.env['MINIO_BUCKET'] || 'ntask';
}

/** MinIO defaults to us-east-1 regardless of where it actually runs. */
function region(): string {
  return process.env['MINIO_REGION'] || 'us-east-1';
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/** Percent-encode each path segment, leaving the separators intact. */
function encodeKey(objectKey: string): string {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

export interface PresignOptions {
  method: 'PUT' | 'GET' | 'DELETE';
  /** e.g. http://minio:9000 or http://localhost:9000 */
  endpoint: string;
  bucket: string;
  objectKey: string;
  ttlSeconds: number;
  /** Advisory only — the payload is signed as UNSIGNED-PAYLOAD. */
  contentType?: string;
}

/**
 * Generate an AWS Signature V4 presigned URL for MinIO.
 *
 * MinIO speaks the S3 v4 API. Presigned URLs embed the signature in query
 * parameters so the caller issues an otherwise unsigned request that MinIO still
 * validates.
 *
 * References:
 *   https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 */
export function presignS3Url(opts: PresignOptions): { url: string; expiresAt: string } {
  const { method, endpoint, bucket, objectKey, ttlSeconds, contentType } = opts;

  const accessKey = process.env['MINIO_ACCESS_KEY'] || '';
  const secretKey = process.env['MINIO_SECRET_KEY'] || '';

  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '');            // yyyyMMdd
  const amzdate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, ''); // yyyyMMddTHHmmssZ

  const service = 's3';
  const credentialScope = `${datestamp}/${region()}/${service}/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;

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

  const host = new URL(endpoint).host;
  const canonicalUri = `/${bucket}/${encodeKey(objectKey)}`;

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzdate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Signing key: HMAC(HMAC(HMAC(HMAC("AWS4" + secret, date), region), service), "aws4_request")
  const kDate = hmacSha256(`AWS4${secretKey}`, datestamp);
  const kRegion = hmacSha256(kDate, region());
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    url: `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };
}
