-- Down for 026_share_link_token_default.sql
-- Removes the DEFAULT; does NOT null out backfilled tokens (destructive/unsafe
-- to reverse — existing share links would break) and does NOT drop the
-- UNIQUE constraint (predates this migration, owned by 021).
ALTER TABLE public.np_list_shares
  ALTER COLUMN token DROP DEFAULT;
