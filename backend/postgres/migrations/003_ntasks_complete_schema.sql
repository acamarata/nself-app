-- Migration 003: Complete ɳTask schema
--
-- The base schema in init.sql already covers:
--   - np_todos advanced columns (due_date, priority, tags, notes, reminder_time,
--     location_*, recurrence_*, attachments, approval fields)
--   - np_profiles preference columns (time_format, auto_hide_completed,
--     default_list_id, notification_settings, theme_preference)
--   - np_lists location columns (location_*, reminder_on_arrival)
--   - np_notifications table + RLS
--   - np_recurring_instances table + RLS
--
-- This migration adds only what is genuinely missing:
--   1. np_user_preferences — separate preferences table (distinct from np_profiles)
--   2. Upgrade np_todos.priority CHECK to include 'urgent'

-- ---------------------------------------------------------------------------
-- np_todos: extend priority CHECK to include 'urgent'
-- ---------------------------------------------------------------------------
-- PostgreSQL does not support ALTER CONSTRAINT inline. Drop and recreate.
ALTER TABLE public.np_todos DROP CONSTRAINT IF EXISTS np_todos_priority_check;
ALTER TABLE public.np_todos
  ADD CONSTRAINT np_todos_priority_check
    CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent'));

-- ---------------------------------------------------------------------------
-- np_user_preferences: NEW table (separate from np_profiles for flexibility)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.np_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
  auto_hide_completed BOOLEAN DEFAULT false,
  theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
  default_list_id UUID REFERENCES public.np_lists(id) ON DELETE SET NULL,
  notification_settings JSONB DEFAULT '{"push": true, "email": true, "inApp": true}',
  source_account_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_np_user_preferences_updated_at ON public.np_user_preferences;
CREATE TRIGGER set_np_user_preferences_updated_at
  BEFORE UPDATE ON public.np_user_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS for np_user_preferences
-- ---------------------------------------------------------------------------
ALTER TABLE public.np_user_preferences ENABLE ROW LEVEL SECURITY;

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
