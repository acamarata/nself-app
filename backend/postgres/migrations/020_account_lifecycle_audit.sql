-- Migration 020: Account lifecycle audit log entries
-- J-S3-T1, J-S3-T2: Extend np_activity to support account-lifecycle events
--
-- The existing np_activity table requires todo_id NOT NULL, which prevents
-- recording account-level events (deletion, export) that are not tied to a todo.
-- This migration adds an account_activity table for user-scoped audit records.

CREATE TABLE IF NOT EXISTS public.np_account_activity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  -- Recognized actions: 'account_delete_requested', 'account_deleted',
  --   'data_export_requested', 'data_export_ready',
  --   'email_change_requested', 'password_changed',
  --   'mfa_enabled', 'mfa_disabled',
  --   'session_revoked', 'invite_rate_limited'
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_np_account_activity_user_id
  ON public.np_account_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_np_account_activity_created_at
  ON public.np_account_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_np_account_activity_action
  ON public.np_account_activity(action);

-- RLS: users can only read their own account activity
ALTER TABLE public.np_account_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_activity_select_own"
  ON public.np_account_activity FOR SELECT
  USING (user_id = auth.uid());

-- Inserts are admin-only (functions service uses admin secret, not user JWT)
-- No INSERT policy for role=user intentionally — only the server-side function inserts.
