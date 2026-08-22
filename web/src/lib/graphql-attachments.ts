/**
 * graphql-attachments.ts — Attachment GraphQL operations for ɳTask web
 * Purpose: Typed CRUD layer for np_attachments + Hasura presigned URL actions.
 * Inputs: todoId, attachment mutation inputs, fileName/mimeType for upload.
 * Outputs: NpAttachment[] / NpAttachment | null / boolean / UploadUrlResult / DownloadUrlResult.
 * Constraints: Inline GQL strings; uses same gql() HTTP client as graphql.ts.
 * SPORT: D2-S7-T1
 */
import { gql } from './api.js';

// ── Domain type ────────────────────────────────────────────────────────────

export interface NpAttachment {
  id: string;
  todo_id: string;
  uploader_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  bucket: string;
  created_at: string;
}

export interface CreateAttachmentInput {
  todo_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
}

// `uploader_id` and `bucket` are deliberately absent. Hasura presets
// uploader_id to X-Hasura-User-Id, and `bucket` was removed from the role's
// insertable columns because getDownloadUrl honours it — a client-chosen
// bucket allowed cross-bucket traversal. Sending either is rejected.

// ── GQL strings ────────────────────────────────────────────────────────────

const GET_ATTACHMENTS = `
  query GetAttachments($todoId: uuid!) {
    np_attachments(
      where: { todo_id: { _eq: $todoId } }
      order_by: { created_at: asc }
    ) {
      id
      todo_id
      uploader_id
      file_name
      file_size_bytes
      mime_type
      storage_key
      bucket
      created_at
    }
  }
`;

const CREATE_ATTACHMENT = `
  mutation CreateAttachment($input: np_attachments_insert_input!) {
    insert_np_attachments_one(object: $input) {
      id
      todo_id
      uploader_id
      file_name
      file_size_bytes
      mime_type
      storage_key
      bucket
      created_at
    }
  }
`;

const DELETE_ATTACHMENT = `
  mutation DeleteAttachment($id: uuid!) {
    delete_np_attachments_by_pk(id: $id) {
      id
    }
  }
`;

const GET_UPLOAD_URL = `
  mutation GetUploadUrl($fileName: String!, $mimeType: String!, $todoId: String!) {
    getUploadUrl(fileName: $fileName, mimeType: $mimeType, todoId: $todoId) {
      uploadUrl
      storagePath
      expiresAt
    }
  }
`;

const GET_DOWNLOAD_URL = `
  mutation GetDownloadUrl($attachmentId: String!) {
    getDownloadUrl(attachmentId: $attachmentId) {
      downloadUrl
      expiresAt
    }
  }
`;

// ── Presigned URL types ────────────────────────────────────────────────────

export interface UploadUrlResult {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface DownloadUrlResult {
  downloadUrl: string;
  expiresAt: string;
}

// ── API functions ──────────────────────────────────────────────────────────

export async function getAttachments(todoId: string): Promise<NpAttachment[]> {
  const res = await gql<{ np_attachments: NpAttachment[] }>(GET_ATTACHMENTS, { todoId });
  if (res.error || !res.data) return [];
  return res.data.np_attachments;
}

export async function createAttachment(input: CreateAttachmentInput): Promise<NpAttachment | null> {
  const res = await gql<{ insert_np_attachments_one: NpAttachment }>(CREATE_ATTACHMENT, { input });
  if (res.error || !res.data) return null;
  return res.data.insert_np_attachments_one;
}

export async function deleteAttachment(id: string): Promise<boolean> {
  const res = await gql<{ delete_np_attachments_by_pk: { id: string } }>(DELETE_ATTACHMENT, { id });
  return !res.error && !!res.data?.delete_np_attachments_by_pk;
}

export async function getUploadUrl(
  fileName: string,
  mimeType: string,
  todoId: string,
): Promise<UploadUrlResult | null> {
  const res = await gql<{ getUploadUrl: UploadUrlResult }>(GET_UPLOAD_URL, { fileName, mimeType, todoId });
  if (res.error || !res.data) return null;
  return res.data.getUploadUrl;
}

export async function getDownloadUrl(attachmentId: string): Promise<DownloadUrlResult | null> {
  const res = await gql<{ getDownloadUrl: DownloadUrlResult }>(GET_DOWNLOAD_URL, { attachmentId });
  if (res.error || !res.data) return null;
  return res.data.getDownloadUrl;
}
