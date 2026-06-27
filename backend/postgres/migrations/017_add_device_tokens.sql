-- Migration 017: Add np_device_tokens table (push notification device registration)
-- Stores FCM/APNs tokens per user device for push delivery (notify plugin).
-- token TEXT UNIQUE prevents duplicate registrations across users.

CREATE TABLE IF NOT EXISTS public.np_device_tokens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform          TEXT        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token             TEXT        NOT NULL UNIQUE,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_np_device_tokens_user_id        ON public.np_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_np_device_tokens_source_account ON public.np_device_tokens(source_account_id);

DROP TRIGGER IF EXISTS set_np_device_tokens_updated_at ON public.np_device_tokens;
CREATE TRIGGER set_np_device_tokens_updated_at
  BEFORE UPDATE ON public.np_device_tokens
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.np_device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: owner-only for all operations
DROP POLICY IF EXISTS device_tokens_select_policy ON public.np_device_tokens;
CREATE POLICY device_tokens_select_policy ON public.np_device_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_insert_policy ON public.np_device_tokens;
CREATE POLICY device_tokens_insert_policy ON public.np_device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_update_policy ON public.np_device_tokens;
CREATE POLICY device_tokens_update_policy ON public.np_device_tokens
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_delete_policy ON public.np_device_tokens;
CREATE POLICY device_tokens_delete_policy ON public.np_device_tokens
  FOR DELETE USING (user_id = auth.uid());
