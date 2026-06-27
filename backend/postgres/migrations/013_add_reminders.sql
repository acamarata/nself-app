-- Migration 013: Add np_reminders table (multi-reminder support)
-- Replaces the single np_todos.reminder_time TIMESTAMPTZ (column kept deprecated).
-- Reminders are personal: only the user who set the reminder can see/modify it.
-- Partial index on remind_at WHERE sent = false is used by the dispatch cron.

CREATE TABLE IF NOT EXISTS public.np_reminders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID        NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel           TEXT        NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'email', 'both')),
  remind_at         TIMESTAMPTZ NOT NULL,
  sent              BOOLEAN     NOT NULL DEFAULT false,
  sent_at           TIMESTAMPTZ,
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (todo_id, user_id, remind_at)
);

CREATE INDEX IF NOT EXISTS idx_np_reminders_todo_id        ON public.np_reminders(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_reminders_user_id        ON public.np_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_np_reminders_pending        ON public.np_reminders(remind_at)
  WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_np_reminders_source_account ON public.np_reminders(source_account_id);

ALTER TABLE public.np_reminders ENABLE ROW LEVEL SECURITY;

-- RLS: owner-only for all operations (user_id = auth.uid())
DROP POLICY IF EXISTS reminders_select_policy ON public.np_reminders;
CREATE POLICY reminders_select_policy ON public.np_reminders
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS reminders_insert_policy ON public.np_reminders;
CREATE POLICY reminders_insert_policy ON public.np_reminders
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reminders_update_policy ON public.np_reminders;
CREATE POLICY reminders_update_policy ON public.np_reminders
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS reminders_delete_policy ON public.np_reminders;
CREATE POLICY reminders_delete_policy ON public.np_reminders
  FOR DELETE USING (user_id = auth.uid());
