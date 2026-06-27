-------------------------------------------------------------------------------
-- Task Approval System Migration
--
-- Adds task approval functionality with roles (owner/admin/member) for lists.
-- Members can complete tasks with photos, owners/admins can approve/reject.
--
-- Features:
-- - List members with roles (owner, admin, member)
-- - Task approval workflow (requires_approval, approved, approved_by)
-- - Photo completion requirements (requires_photo, completion_photo_url)
-- - Completion tracking (completed_by, completion_notes)
--
-- Use Case: Family chore lists where kids complete tasks and parents approve
-------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- List Members table (roles for list access control)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.np_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.np_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  added_by UUID NOT NULL REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  source_account_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, user_id)
);

-- Indexes for list members
CREATE INDEX IF NOT EXISTS idx_np_list_members_list_id ON public.np_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_np_list_members_user_id ON public.np_list_members(user_id);
CREATE INDEX IF NOT EXISTS idx_np_list_members_role ON public.np_list_members(role);

-- Updated_at trigger for list members
DROP TRIGGER IF EXISTS set_np_list_members_updated_at ON public.np_list_members;
CREATE TRIGGER set_np_list_members_updated_at
  BEFORE UPDATE ON public.np_list_members
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Add task approval fields to np_todos
-- ---------------------------------------------------------------------------
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS requires_photo BOOLEAN DEFAULT false;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS completion_photo_url TEXT;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.np_todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Indexes for approval fields
CREATE INDEX IF NOT EXISTS idx_np_todos_requires_approval ON public.np_todos(requires_approval);
CREATE INDEX IF NOT EXISTS idx_np_todos_approved ON public.np_todos(approved);
CREATE INDEX IF NOT EXISTS idx_np_todos_completed_by ON public.np_todos(completed_by);
CREATE INDEX IF NOT EXISTS idx_np_todos_approved_by ON public.np_todos(approved_by);

-- ---------------------------------------------------------------------------
-- Auto-add list creator as owner when list is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_list_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.np_list_members (list_id, user_id, role, added_by)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id)
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_list_created_add_owner ON public.np_lists;
CREATE TRIGGER on_list_created_add_owner
  AFTER INSERT ON public.np_lists
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_list_owner();

-- ---------------------------------------------------------------------------
-- Helper functions for task approval
-- ---------------------------------------------------------------------------

-- Get user's role in a list
CREATE OR REPLACE FUNCTION public.get_user_list_role(
  p_list_id UUID,
  p_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.np_list_members
  WHERE list_id = p_list_id AND user_id = p_user_id;

  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can approve tasks (owner or admin)
CREATE OR REPLACE FUNCTION public.can_approve_tasks(
  p_list_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := public.get_user_list_role(p_list_id, p_user_id);
  RETURN user_role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve a task
CREATE OR REPLACE FUNCTION public.approve_task(
  p_todo_id UUID,
  p_approver_id UUID
)
RETURNS void AS $$
DECLARE
  todo_list_id UUID;
BEGIN
  -- Get the list_id for the todo
  SELECT list_id INTO todo_list_id FROM public.np_todos WHERE id = p_todo_id;

  -- Check if user can approve
  IF NOT public.can_approve_tasks(todo_list_id, p_approver_id) THEN
    RAISE EXCEPTION 'User does not have permission to approve tasks in this list';
  END IF;

  -- Approve the task
  UPDATE public.np_todos
  SET
    approved = true,
    approved_by = p_approver_id,
    approved_at = now(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL,
    updated_at = now()
  WHERE id = p_todo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a task
CREATE OR REPLACE FUNCTION public.reject_task(
  p_todo_id UUID,
  p_rejector_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  todo_list_id UUID;
BEGIN
  -- Get the list_id for the todo
  SELECT list_id INTO todo_list_id FROM public.np_todos WHERE id = p_todo_id;

  -- Check if user can reject
  IF NOT public.can_approve_tasks(todo_list_id, p_rejector_id) THEN
    RAISE EXCEPTION 'User does not have permission to reject tasks in this list';
  END IF;

  -- Reject the task (unmark as completed, reset approval)
  UPDATE public.np_todos
  SET
    completed = false,
    completed_by = NULL,
    completed_at = NULL,
    approved = false,
    approved_by = NULL,
    approved_at = NULL,
    rejected_by = p_rejector_id,
    rejected_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_todo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Migration: Add list creator as owner for existing lists
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  list_record RECORD;
BEGIN
  FOR list_record IN
    SELECT id, user_id FROM public.np_lists
  LOOP
    INSERT INTO public.np_list_members (list_id, user_id, role, added_by)
    VALUES (list_record.id, list_record.user_id, 'owner', list_record.user_id)
    ON CONFLICT (list_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS) Policies for List Members
-- ---------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE public.np_list_members ENABLE ROW LEVEL SECURITY;

-- Users can view members of lists they have access to
CREATE POLICY "Users can view list members"
  ON public.np_list_members
  FOR SELECT
  USING (
    -- Can see if they're a member
    user_id = auth.uid()
    OR
    -- Can see if they have access to the list
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_list_members.list_id AND m.user_id = auth.uid()
    )
  );

-- Only owners and admins can add members
CREATE POLICY "Owners and admins can add members"
  ON public.np_list_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = list_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Only owners can change member roles or remove members
CREATE POLICY "Owners can manage members"
  ON public.np_list_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_list_members.list_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- Only owners can remove members
CREATE POLICY "Owners can remove members"
  ON public.np_list_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_list_members.list_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Update np_todos RLS policies to respect list member roles
-- ---------------------------------------------------------------------------

-- Drop existing policies (we'll recreate them with role checks)
DROP POLICY IF EXISTS "Users can view their own todos" ON public.np_todos;
DROP POLICY IF EXISTS "Users can view public todos" ON public.np_todos;
DROP POLICY IF EXISTS "Users can create their own todos" ON public.np_todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON public.np_todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON public.np_todos;

-- Users can view todos in lists they have access to
CREATE POLICY "Users can view accessible todos"
  ON public.np_todos
  FOR SELECT
  USING (
    -- Own todos
    user_id = auth.uid()
    OR
    -- Public todos
    is_public = true
    OR
    -- Member of the list
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_todos.list_id AND m.user_id = auth.uid()
    )
    OR
    -- Shared directly with user
    EXISTS (
      SELECT 1 FROM public.np_todo_shares s
      WHERE s.todo_id = np_todos.id AND s.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Users can create todos in lists they're members of
CREATE POLICY "Members can create todos"
  ON public.np_todos
  FOR INSERT
  WITH CHECK (
    -- Own list
    EXISTS (SELECT 1 FROM public.np_lists WHERE id = list_id AND user_id = auth.uid())
    OR
    -- Member of the list
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_todos.list_id AND m.user_id = auth.uid()
    )
  );

-- Members can update todos, but only owners/admins can approve
CREATE POLICY "Members can update todos"
  ON public.np_todos
  FOR UPDATE
  USING (
    -- Own todos
    user_id = auth.uid()
    OR
    -- Member of the list (can update, but approval will be checked by function)
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_todos.list_id AND m.user_id = auth.uid()
    )
  );

-- Only todo creator or list owners/admins can delete
CREATE POLICY "Owners and creators can delete todos"
  ON public.np_todos
  FOR DELETE
  USING (
    -- Own todos
    user_id = auth.uid()
    OR
    -- Owner or admin of the list
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_todos.list_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Completion tracking trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_todo_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If marking as completed
  IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) THEN
    NEW.completed_by = auth.uid();
    NEW.completed_at = now();

    -- If task doesn't require approval, auto-approve it
    IF NEW.requires_approval = false THEN
      NEW.approved = true;
      NEW.approved_by = NEW.completed_by;
      NEW.approved_at = now();
    END IF;
  END IF;

  -- If unmarking as completed (rejected)
  IF NEW.completed = false AND OLD.completed = true THEN
    NEW.completed_by = NULL;
    NEW.completed_at = NULL;
    NEW.approved = false;
    NEW.approved_by = NULL;
    NEW.approved_at = NULL;
    NEW.completion_photo_url = NULL;
    NEW.completion_notes = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS track_completion ON public.np_todos;
CREATE TRIGGER track_completion
  BEFORE UPDATE OF completed ON public.np_todos
  FOR EACH ROW
  EXECUTE PROCEDURE public.track_todo_completion();

-- ---------------------------------------------------------------------------
-- Complete: Task Approval System is ready!
-- ---------------------------------------------------------------------------
--
-- Usage:
-- 1. Create a list (owner role auto-assigned)
-- 2. Add members: INSERT INTO np_list_members (list_id, user_id, role, added_by) VALUES (...)
-- 3. Create todos with requires_approval = true
-- 4. Members complete tasks (completed = true, with optional photo)
-- 5. Owners/admins approve: SELECT public.approve_task(todo_id, approver_id)
-- 6. Owners/admins reject: SELECT public.reject_task(todo_id, rejector_id, 'reason')
--
-- TV App Use Case:
-- - Family chore list shared on TV
-- - Kids (members) mark chores complete, take photos
-- - Parents (owners/admins) see "Awaiting Approval" and approve/reject
-- - Real-time updates across all devices (TV, phones, tablets)
-------------------------------------------------------------------------------
