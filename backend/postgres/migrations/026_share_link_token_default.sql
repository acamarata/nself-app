-- Migration 026: np_list_shares.token auto-generate + backfill + uniqueness
--
-- Purpose:
--   P1 fix — np_list_shares.token was only ever set by application code
--   (createShareLink in functions/collab-ops.ts). Any row inserted without
--   an explicit token (e.g. plain member-invite shares, seed data, future
--   insert paths) silently leaves token NULL, breaking the public
--   /shared/{token} URL end-to-end.
--
--   This migration makes the column self-healing at the DB layer:
--     1. DEFAULT generates a collision-resistant random token so ANY insert
--        that omits `token` still gets one.
--     2. Backfill sets a token for existing NULL rows.
--     3. UNIQUE constraint is (re)confirmed — migration 021 already declared
--        `token TEXT UNIQUE`, so this is a no-op verification, not a new
--        constraint (guarded so re-running never errors).
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS / conditional DO blocks.
-- Constraints: requires pgcrypto for gen_random_bytes (already enabled by
--   postgres/init.sql — CREATE EXTENSION IF NOT EXISTS pgcrypto).

-- ---------------------------------------------------------------------------
-- 1. Auto-generate token on any insert that doesn't specify one
-- ---------------------------------------------------------------------------
ALTER TABLE public.np_list_shares
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- ---------------------------------------------------------------------------
-- 2. Backfill existing NULL tokens (each row gets its own random value —
--    do NOT use a single UPDATE ... SET token = <one value>, that would
--    collide on the UNIQUE constraint for >1 NULL row)
-- ---------------------------------------------------------------------------
UPDATE public.np_list_shares
SET token = encode(gen_random_bytes(16), 'hex')
WHERE token IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Confirm UNIQUE constraint on token exists (migration 021 added it via
--    `token TEXT UNIQUE`). Guarded add-if-missing for safety/idempotency.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'np_list_shares'
      AND c.contype = 'u'
      AND c.conkey = (
        SELECT array_agg(a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attname = 'token'
      )
  ) THEN
    ALTER TABLE public.np_list_shares
      ADD CONSTRAINT np_list_shares_token_key UNIQUE (token);
  END IF;
END $$;
