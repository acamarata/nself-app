-- Migration 016: Add np_offline_outbox table (server-side offline sync deduplication)
-- Also adds idempotency_key to np_todos and np_comments to prevent duplicate inserts
-- on offline reconnect.

-- Add idempotency_key to np_todos (already exists on np_comments from migration 010)
ALTER TABLE public.np_todos
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_np_todos_idempotency_key ON public.np_todos(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Offline outbox: server-side log for mutation deduplication
CREATE TABLE IF NOT EXISTS public.np_offline_outbox (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key   TEXT        NOT NULL,
  mutation_type     TEXT        NOT NULL,
  payload           JSONB       NOT NULL,
  result            JSONB,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message     TEXT,
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ,
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_np_offline_outbox_user_status    ON public.np_offline_outbox(user_id, status);
CREATE INDEX IF NOT EXISTS idx_np_offline_outbox_idempotency    ON public.np_offline_outbox(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_np_offline_outbox_source_account ON public.np_offline_outbox(source_account_id);

ALTER TABLE public.np_offline_outbox ENABLE ROW LEVEL SECURITY;

-- RLS: owner-only for all operations
DROP POLICY IF EXISTS offline_outbox_select_policy ON public.np_offline_outbox;
CREATE POLICY offline_outbox_select_policy ON public.np_offline_outbox
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS offline_outbox_insert_policy ON public.np_offline_outbox;
CREATE POLICY offline_outbox_insert_policy ON public.np_offline_outbox
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS offline_outbox_update_policy ON public.np_offline_outbox;
CREATE POLICY offline_outbox_update_policy ON public.np_offline_outbox
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS offline_outbox_delete_policy ON public.np_offline_outbox;
CREATE POLICY offline_outbox_delete_policy ON public.np_offline_outbox
  FOR DELETE USING (user_id = auth.uid());
