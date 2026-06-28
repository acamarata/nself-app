-- Migration 006: List Groups
-- Groups are named collections of lists (e.g. "Work", "Personal")

CREATE TABLE IF NOT EXISTS public.np_list_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  position INTEGER DEFAULT 0,
  source_account_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_np_list_groups_source_account ON public.np_list_groups(source_account_id);

-- Add group_id to np_lists (nullable — lists can be ungrouped)
ALTER TABLE public.np_lists
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.np_list_groups(id) ON DELETE SET NULL;

-- RLS for np_list_groups
ALTER TABLE public.np_list_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own groups" ON public.np_list_groups;
CREATE POLICY "Users can view their own groups"
  ON public.np_list_groups FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own groups" ON public.np_list_groups;
CREATE POLICY "Users can create their own groups"
  ON public.np_list_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own groups" ON public.np_list_groups;
CREATE POLICY "Users can update their own groups"
  ON public.np_list_groups FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own groups" ON public.np_list_groups;
CREATE POLICY "Users can delete their own groups"
  ON public.np_list_groups FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger for np_list_groups (idempotent)
CREATE OR REPLACE FUNCTION update_np_list_groups_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_np_list_groups_updated_at ON public.np_list_groups;
CREATE TRIGGER set_np_list_groups_updated_at
  BEFORE UPDATE ON public.np_list_groups
  FOR EACH ROW EXECUTE FUNCTION update_np_list_groups_updated_at();
