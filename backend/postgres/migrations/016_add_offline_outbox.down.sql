-- Migration 016 rollback: Remove np_offline_outbox and idempotency_key columns
DROP TABLE IF EXISTS public.np_offline_outbox CASCADE;
ALTER TABLE public.np_todos DROP COLUMN IF EXISTS idempotency_key;
