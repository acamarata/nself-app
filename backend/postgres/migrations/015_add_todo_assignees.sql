-- Migration 015: Add np_todo_assignees table (multi-assignee support)
-- Replaces np_todos.assigned_to_user_id (single value, column kept deprecated).
-- Backfill from np_todos.assigned_to_user_id WHERE NOT NULL.

CREATE TABLE IF NOT EXISTS public.np_todo_assignees (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID        NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  assignee_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (todo_id, assignee_id)
);

CREATE INDEX IF NOT EXISTS idx_np_todo_assignees_todo_id        ON public.np_todo_assignees(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_todo_assignees_assignee_id    ON public.np_todo_assignees(assignee_id);
CREATE INDEX IF NOT EXISTS idx_np_todo_assignees_source_account ON public.np_todo_assignees(source_account_id);

ALTER TABLE public.np_todo_assignees ENABLE ROW LEVEL SECURITY;

-- SELECT: assignee OR todo owner OR list member
DROP POLICY IF EXISTS todo_assignees_select_policy ON public.np_todo_assignees;
CREATE POLICY todo_assignees_select_policy ON public.np_todo_assignees
  FOR SELECT USING (
    assignee_id = auth.uid()
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

-- INSERT: assigned_by = auth.uid() AND (todo owner OR list owner/admin)
DROP POLICY IF EXISTS todo_assignees_insert_policy ON public.np_todo_assignees;
CREATE POLICY todo_assignees_insert_policy ON public.np_todo_assignees
  FOR INSERT WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
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

-- DELETE: self-removal OR todo owner OR list owner/admin
DROP POLICY IF EXISTS todo_assignees_delete_policy ON public.np_todo_assignees;
CREATE POLICY todo_assignees_delete_policy ON public.np_todo_assignees
  FOR DELETE USING (
    assignee_id = auth.uid()
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

-- Backfill from deprecated single-assignee column
INSERT INTO public.np_todo_assignees (todo_id, assignee_id, assigned_by, assigned_at, source_account_id)
SELECT
  id,
  assigned_to_user_id,
  user_id,
  created_at,
  source_account_id
FROM public.np_todos
WHERE assigned_to_user_id IS NOT NULL
ON CONFLICT (todo_id, assignee_id) DO NOTHING;
