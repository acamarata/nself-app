/**
 * graphql-attachments.ts — Attachment GraphQL operations for ɳTask web
 * Purpose: Typed CRUD layer for np_attachments + the presigned URL actions.
 * Inputs: todoId, attachment mutation inputs, fileName/mimeType for upload.
 * Outputs: NpAttachment[] / NpAttachment | null / boolean / UploadUrlResult / DownloadUrlResult.
 * Constraints: GQL strings + types live in @nself/ntask-core (shared across
 *              surfaces); this file wires them to the web gql() client. It used
 *              to carry its own hand-written copies, which drifted to
 *              filename/size_bytes/user_id against a schema that has
 *              file_name/file_size_bytes/uploader_id — every attachment query
 *              failed validation. Do not reintroduce local query strings.
 * SPORT: D2-S7-T1
 */
import { gql } from './api.js';
import {
  GET_ATTACHMENTS,
  CREATE_ATTACHMENT,
  DELETE_ATTACHMENT,
  GET_UPLOAD_URL,
  GET_DOWNLOAD_URL,
} from '@nself/ntask-core';
import type { NpAttachment, CreateAttachmentInput } from '@nself/ntask-core';

export type { NpAttachment, CreateAttachmentInput };

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

/**
 * `bucket` and `uploader_id` are absent from CreateAttachmentInput on purpose:
 * Hasura presets the uploader, and bucket is not client-insertable because
 * getDownloadUrl honours it and signs with the storage root credentials.
 */
export async function createAttachment(input: CreateAttachmentInput): Promise<NpAttachment | null> {
  const res = await gql<{ insert_np_attachments_one: NpAttachment }>(CREATE_ATTACHMENT, {
    todoId: input.todo_id,
    storageKey: input.storage_key,
    fileName: input.file_name,
    mimeType: input.mime_type,
    fileSizeBytes: input.file_size_bytes,
    acl: input.acl ?? null,
    commentId: input.comment_id ?? null,
  });
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
