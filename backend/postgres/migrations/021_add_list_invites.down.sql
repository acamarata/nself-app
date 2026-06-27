-- Rollback migration 021

-- Remove share-link columns from np_list_shares
DROP INDEX IF EXISTS idx_np_list_shares_token;
ALTER TABLE public.np_list_shares
  DROP COLUMN IF EXISTS token,
  DROP COLUMN IF EXISTS expires_at;

-- Drop np_list_invites
DROP TRIGGER IF EXISTS set_np_list_invites_updated_at ON public.np_list_invites;
DROP INDEX IF EXISTS idx_np_list_invites_source_account;
DROP INDEX IF EXISTS idx_np_list_invites_expires_at;
DROP INDEX IF EXISTS idx_np_list_invites_status;
DROP INDEX IF EXISTS idx_np_list_invites_token;
DROP INDEX IF EXISTS idx_np_list_invites_invited_by;
DROP INDEX IF EXISTS idx_np_list_invites_invited_email;
DROP INDEX IF EXISTS idx_np_list_invites_list_id;
DROP TABLE IF EXISTS public.np_list_invites;
