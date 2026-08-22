/**
 * Purpose: Attachment upload/download/delete for a task, on mobile.
 * Inputs: todoId.
 * Outputs: { upload, getDownloadUrl, remove, uploading, error }.
 * Constraints: upload is a three-step contract (see uploadFile); the PUT must
 *              carry no Authorization header or the presigned signature breaks.
 * SPORT: P5-C-mobile — attachments parity with web.
 */

import { useCallback, useState } from 'react';
import { useMutation } from 'urql';
import {
  CREATE_ATTACHMENT,
  DELETE_ATTACHMENT,
  GET_UPLOAD_URL,
  GET_DOWNLOAD_URL,
} from '@nself/ntask-core';
import { MAX_ATTACHMENT_BYTES } from '@nself/ntask-core';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export type AttachmentError =
  | 'too-large'
  | 'presign-failed'
  | 'upload-failed'
  | 'record-failed'
  | 'download-failed'
  | 'delete-failed';

export function useAttachments(todoId: string) {
  const [, execUploadUrl] = useMutation(GET_UPLOAD_URL);
  const [, execDownloadUrl] = useMutation(GET_DOWNLOAD_URL);
  const [, execCreate] = useMutation(CREATE_ATTACHMENT);
  const [, execDelete] = useMutation(DELETE_ATTACHMENT);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<AttachmentError | null>(null);

  /**
   * Three steps, all required:
   *   1. ask the server to presign a PUT and tell us the storage path
   *   2. PUT the bytes straight to storage
   *   3. record the row, using the path from step 1
   *
   * Step 3 is not optional bookkeeping: without it the object exists but no
   * query returns it, so the user sees a successful upload and no attachment.
   * The size check runs first because the server rejects oversized uploads only
   * after the bytes have been sent, which on cellular is a real cost.
   */
  const upload = useCallback(
    async (file: PickedFile): Promise<boolean> => {
      setError(null);

      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError('too-large');
        return false;
      }

      setUploading(true);
      try {
        const presign = await execUploadUrl({
          fileName: file.name,
          mimeType: file.mimeType,
          todoId,
        });
        const grant = presign.data?.getUploadUrl;
        if (presign.error || !grant?.uploadUrl) {
          setError('presign-failed');
          return false;
        }

        // Deliberately no Authorization header: the signature in the query
        // string IS the authorisation, and adding one invalidates it.
        const body = await (await fetch(file.uri)).blob();
        const put = await fetch(grant.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.mimeType },
          body,
        });
        if (!put.ok) {
          setError('upload-failed');
          return false;
        }

        // `bucket` and `uploader_id` are intentionally absent — the server sets
        // both. See @nself/ntask-core CreateAttachmentInput.
        const created = await execCreate({
          todoId,
          storageKey: grant.storagePath,
          fileName: file.name,
          mimeType: file.mimeType,
          fileSizeBytes: file.size,
        });
        if (created.error) {
          setError('record-failed');
          return false;
        }
        return true;
      } catch {
        setError('upload-failed');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [todoId, execUploadUrl, execCreate],
  );

  const getDownloadUrl = useCallback(
    async (attachmentId: string): Promise<string | null> => {
      setError(null);
      const res = await execDownloadUrl({ attachmentId });
      const url = res.data?.getDownloadUrl?.downloadUrl;
      if (res.error || !url) {
        setError('download-failed');
        return null;
      }
      return url as string;
    },
    [execDownloadUrl],
  );

  const remove = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      setError(null);
      const res = await execDelete({ id: attachmentId });
      if (res.error) {
        setError('delete-failed');
        return false;
      }
      return true;
    },
    [execDelete],
  );

  return { upload, getDownloadUrl, remove, uploading, error };
}
