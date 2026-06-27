-- Migration 009: Add np_subtasks table
-- Adds structured subtask support per task (checklist items).
-- Each subtask is scoped to its parent np_todos row.
-- RLS chains through np_todos ownership/membership.

CREATE TABLE IF NOT EXISTS public.np_subtasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID        NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  is_done           BOOLEAN     NOT NULL DEFAULT false,
  position          INTEGER     NOT NULL DEFAULT 0,
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_np_subtasks_todo_id         ON public.np_subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_subtasks_source_account  ON public.np_subtasks(source_account_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_np_subtasks_updated_at ON public.np_subtasks;
CREATE TRIGGER set_np_subtasks_updated_at
  BEFORE UPDATE ON public.np_subtasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Enable RLS
ALTER TABLE public.np_subtasks ENABLE ROW LEVEL SECURITY;

-- SELECT: todo owner OR list member
DROP POLICY IF EXISTS subtasks_select_policy ON public.np_subtasks;
CREATE POLICY subtasks_select_policy ON public.np_subtasks
  FOR SELECT USING (
    EXISTS (
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
DROP POLICY IF EXISTS subtasks_insert_policy ON public.np_subtasks;
CREATE POLICY subtasks_insert_policy ON public.np_subtasks
  FOR INSERT WITH CHECK (
    EXISTS (
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

-- UPDATE: todo owner OR list member
DROP POLICY IF EXISTS subtasks_update_policy ON public.np_subtasks;
CREATE POLICY subtasks_update_policy ON public.np_subtasks
  FOR UPDATE USING (
    EXISTS (
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

-- DELETE: todo owner OR list owner/admin
DROP POLICY IF EXISTS subtasks_delete_policy ON public.np_subtasks;
CREATE POLICY subtasks_delete_policy ON public.np_subtasks
  FOR DELETE USING (
    EXISTS (
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
