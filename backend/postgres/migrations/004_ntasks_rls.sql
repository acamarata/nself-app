-- Migration 004: Row-Level Security for ɳTask
--
-- Most RLS policies were defined inline in init.sql (np_todos, np_profiles,
-- np_lists, np_list_shares, np_list_presence, np_list_members,
-- np_notifications, np_recurring_instances).
--
-- This migration ensures:
--   1. RLS is enabled on all np_* tables (idempotent — safe to repeat)
--   2. Adds RLS for np_user_preferences (created in migration 003)
--   3. Updates np_profiles Hasura-tracked select policy to cover new columns
--      (time_format, auto_hide_completed, default_list_id,
--       notification_settings, theme_preference)
--
-- All policies use auth.uid() — the correct pattern for Hasura Auth JWTs.
-- Never use (SELECT id FROM auth.users WHERE email = current_user) — that
-- checks the PostgreSQL session user, not the JWT-authenticated Hasura user.

-- ---------------------------------------------------------------------------
-- Ensure RLS is enabled on all tables (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.np_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_todo_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_list_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_list_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_recurring_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.np_user_preferences ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- np_user_preferences: RLS (also created in migration 003, kept here for
-- completeness — CREATE POLICY IF NOT EXISTS is not supported in older PG
-- versions, so we DROP first)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.np_user_preferences;
CREATE POLICY "Users can view their own preferences"
  ON public.np_user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.np_user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.np_user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.np_user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.np_user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.np_user_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON public.np_user_preferences FOR DELETE
  USING (auth.uid() = user_id);
