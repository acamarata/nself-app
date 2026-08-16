-- 028_attachment_storage_key_owner.sql
--
-- Purpose: Make the "a user may only register a storage_key inside their own
--          prefix" rule enforceable by Hasura row-level permissions.
--
-- Why a generated column:
--   np_attachments rows are inserted by the CLIENT, not by the server.
--   functions/storage-presign.ts::getUploadUrl only *returns* the storagePath
--   (attachments/{userId}/{todoId}/{uuid}-{name}); the client then runs a plain
--   insert_np_attachments mutation with that value. Nothing server-side rewrites
--   it, so the insert permission is the only enforcement point.
--
--   Hasura permission expressions cannot concatenate a session variable with a
--   string literal, so `storage_key LIKE 'attachments/' || X-Hasura-User-Id || '/%'`
--   is not expressible. Projecting the owner segment into its own column lets the
--   permission use a plain `_eq: X-Hasura-User-Id` comparison.
--
-- Threat closed:
--   getDownloadUrl authorises on `uploader_id == caller` and then signs
--   attachment.storage_key with the MinIO root credentials. A user could insert a
--   row on their own todo whose storage_key pointed at another user's object
--   (e.g. exports/{victim}/data-export-*.json) and receive a presigned GET for it.
--
-- Behaviour:
--   * STORED generated column, so it is recomputed for existing rows on ALTER.
--   * Rows whose storage_key does not match the canonical layout yield NULL,
--     which fails the `_eq` permission check (NULL is never equal). Existing rows
--     are unaffected for SELECT/DELETE — only future INSERTs are constrained.
--   * GENERATED ALWAYS means Postgres itself rejects any client-supplied value.
--
-- All functions used are IMMUTABLE, as required for a generated column. The regex
-- guard ensures the ::uuid cast never sees malformed input.
--
-- SPORT: F08 backend; security hardening

ALTER TABLE public.np_attachments
  ADD COLUMN IF NOT EXISTS storage_key_owner UUID
  GENERATED ALWAYS AS (
    CASE
      WHEN storage_key ~ '^attachments/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
        THEN substring(storage_key from 13 for 36)::uuid
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.np_attachments.storage_key_owner IS
  'Derived owner UUID from storage_key (attachments/{uuid}/...). NULL when the key '
  'does not match the canonical layout. Used by the Hasura insert permission to '
  'prevent a user registering a storage_key inside another user''s prefix.';
