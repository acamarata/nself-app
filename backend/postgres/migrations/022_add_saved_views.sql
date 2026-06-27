-- Migration 022: Add np_saved_views table
-- Persistent named filter+sort combinations saved per user.
-- Enables "Saved Views" feature: users can save custom task filters and switch them.
-- source_account_id follows Multi-App Isolation convention (NOT Cloud multi-tenancy).

CREATE TABLE IF NOT EXISTS public.np_saved_views (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  filters           JSONB       NOT NULL DEFAULT '{}',
  sort              JSONB       NOT NULL DEFAULT '{}',
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate view names per user per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_np_saved_views_user_name
  ON public.np_saved_views(user_id, name, source_account_id);

-- Lookup index for listing a user's saved views
CREATE INDEX IF NOT EXISTS idx_np_saved_views_user_id
  ON public.np_saved_views(user_id);

CREATE INDEX IF NOT EXISTS idx_np_saved_views_source_account
  ON public.np_saved_views(source_account_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at_saved_views()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_np_saved_views_updated_at ON public.np_saved_views;
CREATE TRIGGER trg_np_saved_views_updated_at
  BEFORE UPDATE ON public.np_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_saved_views();

-- Enable Row Level Security
ALTER TABLE public.np_saved_views ENABLE ROW LEVEL SECURITY;

-- SELECT: owner only
DROP POLICY IF EXISTS saved_views_select_policy ON public.np_saved_views;
CREATE POLICY saved_views_select_policy ON public.np_saved_views
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: owner only; enforce user_id = caller
DROP POLICY IF EXISTS saved_views_insert_policy ON public.np_saved_views;
CREATE POLICY saved_views_insert_policy ON public.np_saved_views
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: owner only
DROP POLICY IF EXISTS saved_views_update_policy ON public.np_saved_views;
CREATE POLICY saved_views_update_policy ON public.np_saved_views
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: owner only
DROP POLICY IF EXISTS saved_views_delete_policy ON public.np_saved_views;
CREATE POLICY saved_views_delete_policy ON public.np_saved_views
  FOR DELETE USING (user_id = auth.uid());

-- Comment for documentation
COMMENT ON TABLE public.np_saved_views IS
  'Named filter+sort combinations saved per user. Implements Saved Views feature.';
COMMENT ON COLUMN public.np_saved_views.filters IS
  'JSONB filter definition, e.g. {"completed":false,"priority":["high"],"list_id":"uuid"}.';
COMMENT ON COLUMN public.np_saved_views.sort IS
  'JSONB sort definition, e.g. {"field":"due_date","direction":"asc"}.';
COMMENT ON COLUMN public.np_saved_views.source_account_id IS
  'Multi-App Isolation — NOT Cloud multi-tenancy. DEFAULT primary for single-app installs.';
