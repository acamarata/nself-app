-- Migration 010: Add np_comments table
-- Task comments with nested reply support (parent_comment_id self-ref).
-- Soft-delete via deleted_at (application must filter WHERE deleted_at IS NULL).
-- idempotency_key prevents duplicate inserts on offline replay.

CREATE TABLE IF NOT EXISTS public.np_comments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID        NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  author_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID        REFERENCES public.np_comments(id) ON DELETE CASCADE,
  body              TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  idempotency_key   TEXT        UNIQUE,
  edited_at         TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_np_comments_todo_id         ON public.np_comments(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_comments_author_id       ON public.np_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_np_comments_parent          ON public.np_comments(parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_np_comments_source_account  ON public.np_comments(source_account_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_np_comments_updated_at ON public.np_comments;
CREATE TRIGGER set_np_comments_updated_at
  BEFORE UPDATE ON public.np_comments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Enable RLS
ALTER TABLE public.np_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: author OR todo owner OR list member
DROP POLICY IF EXISTS comments_select_policy ON public.np_comments;
CREATE POLICY comments_select_policy ON public.np_comments
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.np_list_shares ls
            WHERE ls.list_id = t.list_id
              AND ls.shared_with_user_id = auth.uid()
              AND ls.accepted_at IS NOT NULL
          )
        )
    )
  );

-- INSERT: todo owner OR list member
DROP POLICY IF EXISTS comments_insert_policy ON public.np_comments;
CREATE POLICY comments_insert_policy ON public.np_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.np_list_shares ls
            WHERE ls.list_id = t.list_id
              AND ls.shared_with_user_id = auth.uid()
              AND ls.accepted_at IS NOT NULL
          )
        )
    )
  );

-- UPDATE: own comments only
DROP POLICY IF EXISTS comments_update_policy ON public.np_comments;
CREATE POLICY comments_update_policy ON public.np_comments
  FOR UPDATE USING (author_id = auth.uid());

-- DELETE: own OR list owner/admin
DROP POLICY IF EXISTS comments_delete_policy ON public.np_comments;
CREATE POLICY comments_delete_policy ON public.np_comments
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.np_list_shares ls
            WHERE ls.list_id = t.list_id
              AND ls.shared_with_user_id = auth.uid()
              AND ls.permission IN ('owner', 'editor')
              AND ls.accepted_at IS NOT NULL
          )
        )
    )
  );
