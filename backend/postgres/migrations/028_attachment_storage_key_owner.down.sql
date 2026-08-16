-- Down migration for 028_attachment_storage_key_owner.sql
-- NOTE: dropping this column re-opens the forged-storage_key vulnerability unless
-- the np_attachments insert permission is reverted at the same time.

ALTER TABLE public.np_attachments
  DROP COLUMN IF EXISTS storage_key_owner;
