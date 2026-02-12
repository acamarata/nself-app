-------------------------------------------------------------------------------
-- nSelf Backend - PostgreSQL Initialization
--
-- This script runs automatically when the PostgreSQL container starts for the
-- first time. It creates the required schemas and extensions.
--
-- Hasura Auth and Hasura Storage will create their own tables automatically
-- when they start. This script only sets up the foundation.
--
-- To add your own tables, use Hasura Migrations:
--   cd backend
--   hasura migrate create <migration_name> --database-name default
--   hasura migrate apply --database-name default
--
-- Or create migrations manually in backend/hasura/migrations/default/
-------------------------------------------------------------------------------

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Auth schema (used by hasura-auth)
CREATE SCHEMA IF NOT EXISTS auth;

-- Storage schema (used by hasura-storage)
CREATE SCHEMA IF NOT EXISTS storage;

-- Public schema tables for the application
-- These are examples. Modify or replace them for your app.

-- ---------------------------------------------------------------------------
-- Profiles table (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Todos table (example feature table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  completed BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Todo Shares table (for sharing todos with specific users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_todo_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES public.app_todos(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(todo_id, shared_with_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_todos_user_id ON public.app_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_app_todos_is_public ON public.app_todos(is_public);
CREATE INDEX IF NOT EXISTS idx_app_todo_shares_todo_id ON public.app_todo_shares(todo_id);
CREATE INDEX IF NOT EXISTS idx_app_todo_shares_email ON public.app_todo_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_app_profiles_id ON public.app_profiles(id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on user signup (trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.display_name, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_app_profiles_updated_at ON public.app_profiles;
CREATE TRIGGER set_app_profiles_updated_at
  BEFORE UPDATE ON public.app_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_todos_updated_at ON public.app_todos;
CREATE TRIGGER set_app_todos_updated_at
  BEFORE UPDATE ON public.app_todos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_todo_shares_updated_at ON public.app_todo_shares;
CREATE TRIGGER set_app_todo_shares_updated_at
  BEFORE UPDATE ON public.app_todo_shares
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lists table (todo list containers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled List',
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'list',
  is_default BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- List Shares table (list-level sharing with permissions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_list_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.app_lists(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'viewer' CHECK (permission IN ('owner', 'editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, shared_with_email)
);

-- ---------------------------------------------------------------------------
-- List Presence table (real-time presence tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_list_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.app_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'viewing' CHECK (status IN ('viewing', 'editing')),
  editing_todo_id UUID REFERENCES public.app_todos(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, user_id)
);

-- Add list_id and position to todos
ALTER TABLE public.app_todos
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES public.app_lists(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_app_lists_user_id ON public.app_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_app_lists_position ON public.app_lists(position);
CREATE INDEX IF NOT EXISTS idx_app_list_shares_list_id ON public.app_list_shares(list_id);
CREATE INDEX IF NOT EXISTS idx_app_list_shares_email ON public.app_list_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_app_list_shares_user_id ON public.app_list_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_app_list_presence_list_id ON public.app_list_presence(list_id);
CREATE INDEX IF NOT EXISTS idx_app_list_presence_last_seen ON public.app_list_presence(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_app_todos_list_id ON public.app_todos(list_id);
CREATE INDEX IF NOT EXISTS idx_app_todos_position ON public.app_todos(position);

-- Updated_at triggers for new tables
DROP TRIGGER IF EXISTS set_app_lists_updated_at ON public.app_lists;
CREATE TRIGGER set_app_lists_updated_at
  BEFORE UPDATE ON public.app_lists
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_list_shares_updated_at ON public.app_list_shares;
CREATE TRIGGER set_app_list_shares_updated_at
  BEFORE UPDATE ON public.app_list_shares
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create default list on user signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_lists (user_id, title, description, is_default, position)
  VALUES (
    NEW.id,
    'My Tasks',
    'Your default todo list',
    true,
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_list ON auth.users;
CREATE TRIGGER on_auth_user_created_list
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_list();

-- ---------------------------------------------------------------------------
-- Presence management functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_presence(
  p_list_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_editing_todo_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.app_list_presence (list_id, user_id, status, editing_todo_id, last_seen_at)
  VALUES (p_list_id, p_user_id, p_status, p_editing_todo_id, now())
  ON CONFLICT (list_id, user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    editing_todo_id = EXCLUDED.editing_todo_id,
    last_seen_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_presence(
  p_list_id UUID,
  p_user_id UUID
)
RETURNS void AS $$
BEGIN
  DELETE FROM public.app_list_presence
  WHERE list_id = p_list_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM public.app_list_presence
  WHERE last_seen_at < now() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Migration: Assign existing todos to default lists
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  user_record RECORD;
  default_list_id UUID;
BEGIN
  -- For each user with todos but no lists, create a default list
  FOR user_record IN
    SELECT DISTINCT t.user_id
    FROM public.app_todos t
    LEFT JOIN public.app_lists l ON l.user_id = t.user_id
    WHERE l.id IS NULL
  LOOP
    -- Create default list for user
    INSERT INTO public.app_lists (user_id, title, description, is_default, position)
    VALUES (
      user_record.user_id,
      'My Tasks',
      'Your default todo list',
      true,
      0
    )
    RETURNING id INTO default_list_id;

    -- Assign all user's todos to this list
    UPDATE public.app_todos
    SET
      list_id = default_list_id,
      position = EXTRACT(EPOCH FROM created_at)::INTEGER
    WHERE user_id = user_record.user_id AND list_id IS NULL;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ---------------------------------------------------------------------------

-- Enable RLS on new tables
ALTER TABLE public.app_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_list_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_list_presence ENABLE ROW LEVEL SECURITY;

-- Lists: Users can see their own lists + lists shared with them
DROP POLICY IF EXISTS lists_select_policy ON public.app_lists;
CREATE POLICY lists_select_policy ON public.app_lists
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.app_list_shares
      WHERE list_id = app_lists.id
        AND shared_with_user_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );

-- Lists: Users can only insert their own lists
DROP POLICY IF EXISTS lists_insert_policy ON public.app_lists;
CREATE POLICY lists_insert_policy ON public.app_lists
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Lists: Users can update their own lists OR shared lists with editor+ permission
DROP POLICY IF EXISTS lists_update_policy ON public.app_lists;
CREATE POLICY lists_update_policy ON public.app_lists
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.app_list_shares
      WHERE list_id = app_lists.id
        AND shared_with_user_id = auth.uid()
        AND permission IN ('owner', 'editor')
        AND accepted_at IS NOT NULL
    )
  );

-- Lists: Only owners can delete
DROP POLICY IF EXISTS lists_delete_policy ON public.app_lists;
CREATE POLICY lists_delete_policy ON public.app_lists
  FOR DELETE USING (user_id = auth.uid());

-- Todos: Scope to list permissions (update existing policy)
DROP POLICY IF EXISTS todos_select_policy ON public.app_todos;
CREATE POLICY todos_select_policy ON public.app_todos
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_public = true
    OR EXISTS (
      SELECT 1 FROM public.app_lists l
      LEFT JOIN public.app_list_shares s ON s.list_id = l.id
      WHERE l.id = app_todos.list_id
        AND (
          l.user_id = auth.uid()
          OR (s.shared_with_user_id = auth.uid() AND s.accepted_at IS NOT NULL)
        )
    )
  );

-- Shares: Users can see shares for their own lists + their own share records
DROP POLICY IF EXISTS shares_select_policy ON public.app_list_shares;
CREATE POLICY shares_select_policy ON public.app_list_shares
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.app_lists WHERE id = list_id AND user_id = auth.uid())
    OR shared_with_user_id = auth.uid()
    OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Shares: Only list owners can create shares
DROP POLICY IF EXISTS shares_insert_policy ON public.app_list_shares;
CREATE POLICY shares_insert_policy ON public.app_list_shares
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.app_lists WHERE id = list_id AND user_id = auth.uid())
  );

-- Shares: Only list owners can update/delete shares
DROP POLICY IF EXISTS shares_update_policy ON public.app_list_shares;
CREATE POLICY shares_update_policy ON public.app_list_shares
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.app_lists WHERE id = list_id AND user_id = auth.uid())
    OR shared_with_user_id = auth.uid() -- Users can accept their own invites
  );

DROP POLICY IF EXISTS shares_delete_policy ON public.app_list_shares;
CREATE POLICY shares_delete_policy ON public.app_list_shares
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.app_lists WHERE id = list_id AND user_id = auth.uid())
  );

-- Presence: Users can see presence for lists they have access to
DROP POLICY IF EXISTS presence_select_policy ON public.app_list_presence;
CREATE POLICY presence_select_policy ON public.app_list_presence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.app_lists l
      LEFT JOIN public.app_list_shares s ON s.list_id = l.id
      WHERE l.id = list_id
        AND (
          l.user_id = auth.uid()
          OR (s.shared_with_user_id = auth.uid() AND s.accepted_at IS NOT NULL)
        )
    )
  );

-- Presence: Users can insert/update their own presence
DROP POLICY IF EXISTS presence_upsert_policy ON public.app_list_presence;
CREATE POLICY presence_upsert_policy ON public.app_list_presence
  FOR ALL USING (user_id = auth.uid());

-- Note: RLS is already enabled on app_todos and app_profiles from original setup
-- Enhanced schema additions for complete todo app

-- Add columns to app_todos for advanced features
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high'));
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMPTZ;
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 100;
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS recurrence_rule TEXT; -- 'daily', 'weekly', 'monthly', 'custom:0 3 * * *'
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES public.app_todos(id) ON DELETE CASCADE;
ALTER TABLE public.app_todos ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Add columns to app_profiles for user preferences
ALTER TABLE public.app_profiles ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h'));
ALTER TABLE public.app_profiles ADD COLUMN IF NOT EXISTS auto_hide_completed BOOLEAN DEFAULT false;
ALTER TABLE public.app_profiles ADD COLUMN IF NOT EXISTS default_list_id UUID REFERENCES public.app_lists(id) ON DELETE SET NULL;
ALTER TABLE public.app_profiles ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"push": true, "email": true, "new_todo": true, "due_reminders": true, "shared_lists": true, "evening_reminder": true, "evening_reminder_time": "20:00"}';
ALTER TABLE public.app_profiles ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system'));

-- Add columns to app_lists for location-based lists
ALTER TABLE public.app_lists ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE public.app_lists ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE public.app_lists ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
ALTER TABLE public.app_lists ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 100;
ALTER TABLE public.app_lists ADD COLUMN IF NOT EXISTS reminder_on_arrival BOOLEAN DEFAULT false;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_todo', 'due_reminder', 'shared_list', 'evening_reminder', 'location_reminder', 'list_update')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create recurring task instances table
CREATE TABLE IF NOT EXISTS public.app_recurring_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_todo_id UUID NOT NULL REFERENCES public.app_todos(id) ON DELETE CASCADE,
  instance_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_todo_id, instance_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON public.app_todos(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_recurrence ON public.app_todos(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.app_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.app_notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_recurring_instances ON public.app_recurring_instances(parent_todo_id, instance_date);

-- RLS policies for notifications
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.app_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.app_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.app_notifications FOR INSERT
  WITH CHECK (true);

-- RLS policies for recurring instances
ALTER TABLE public.app_recurring_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view instances of their todos"
  ON public.app_recurring_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.app_todos
      WHERE app_todos.id = parent_todo_id
      AND app_todos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert instances of their todos"
  ON public.app_recurring_instances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_todos
      WHERE app_todos.id = parent_todo_id
      AND app_todos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update instances of their todos"
  ON public.app_recurring_instances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.app_todos
      WHERE app_todos.id = parent_todo_id
      AND app_todos.user_id = auth.uid()
    )
  );

-- Function to reset daily recurring todos at 3am
CREATE OR REPLACE FUNCTION public.reset_daily_recurring_todos()
RETURNS void AS $$
BEGIN
  -- Mark all daily recurring todos as not completed at 3am
  -- This creates a new instance for today if it doesn't exist
  INSERT INTO public.app_recurring_instances (parent_todo_id, instance_date, completed)
  SELECT 
    id,
    CURRENT_DATE,
    false
  FROM public.app_todos
  WHERE recurrence_rule LIKE 'daily%'
    AND NOT EXISTS (
      SELECT 1 FROM public.app_recurring_instances
      WHERE parent_todo_id = app_todos.id
      AND instance_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.app_notifications (user_id, type, title, body, data, action_url)
  VALUES (p_user_id, p_type, p_title, p_body, p_data, p_action_url)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify on new shared list
CREATE OR REPLACE FUNCTION public.notify_list_shared()
RETURNS TRIGGER AS $$
DECLARE
  list_title TEXT;
  inviter_email TEXT;
BEGIN
  -- Get list title
  SELECT title INTO list_title
  FROM public.app_lists
  WHERE id = NEW.list_id;
  
  -- Get inviter email
  SELECT email INTO inviter_email
  FROM auth.users
  WHERE id = NEW.invited_by;
  
  -- Create notification if user has accepted (has user_id)
  IF NEW.shared_with_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.shared_with_user_id,
      'shared_list',
      'New list shared with you',
      inviter_email || ' shared "' || list_title || '" with you',
      jsonb_build_object('list_id', NEW.list_id, 'share_id', NEW.id),
      '/lists/' || NEW.list_id::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_list_shared
  AFTER INSERT OR UPDATE ON public.app_list_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_list_shared();

