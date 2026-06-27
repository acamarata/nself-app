-- Migration 019 DOWN: Remove tos columns added in 019 UP
-- CASCADE FK changes are intentional structural fixes — not reverted.

ALTER TABLE public.np_profiles
  DROP COLUMN IF EXISTS tos_accepted_at,
  DROP COLUMN IF EXISTS tos_version;

DROP INDEX IF EXISTS idx_np_profiles_tos_accepted_at;
