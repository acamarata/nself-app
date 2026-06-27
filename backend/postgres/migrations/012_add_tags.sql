-- Migration 012: Add np_tags + np_todo_tags (structured tag taxonomy)
-- np_tags: user-scoped tag definitions with name + hex color.
-- np_todo_tags: many-to-many junction linking todos to tags.
-- Replaces the unstructured np_todos.tags TEXT[] (column kept deprecated).

-- np_tags: tag definitions owned by a user
CREATE TABLE IF NOT EXISTS public.np_tags (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  color             TEXT        NOT NULL CHECK (color ~* '^#[0-9a-f]{6}$'),
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_np_tags_user_id        ON public.np_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_np_tags_source_account ON public.np_tags(source_account_id);

DROP TRIGGER IF EXISTS set_np_tags_updated_at ON public.np_tags;
CREATE TRIGGER set_np_tags_updated_at
  BEFORE UPDATE ON public.np_tags
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.np_tags ENABLE ROW LEVEL SECURITY;

-- np_tags RLS: owner-only for all operations
DROP POLICY IF EXISTS tags_select_policy ON public.np_tags;
CREATE POLICY tags_select_policy ON public.np_tags
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS tags_insert_policy ON public.np_tags;
CREATE POLICY tags_insert_policy ON public.np_tags
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tags_update_policy ON public.np_tags;
CREATE POLICY tags_update_policy ON public.np_tags
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS tags_delete_policy ON public.np_tags;
CREATE POLICY tags_delete_policy ON public.np_tags
  FOR DELETE USING (user_id = auth.uid());

-- np_todo_tags: many-to-many junction
CREATE TABLE IF NOT EXISTS public.np_todo_tags (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID        NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  tag_id            UUID        NOT NULL REFERENCES public.np_tags(id) ON DELETE CASCADE,
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (todo_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_np_todo_tags_todo_id        ON public.np_todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_todo_tags_tag_id         ON public.np_todo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_np_todo_tags_source_account ON public.np_todo_tags(source_account_id);

ALTER TABLE public.np_todo_tags ENABLE ROW LEVEL SECURITY;

-- np_todo_tags RLS:
-- SELECT: todo owner OR list member
DROP POLICY IF EXISTS todo_tags_select_policy ON public.np_todo_tags;
CREATE POLICY todo_tags_select_policy ON public.np_todo_tags
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

-- INSERT: tag belongs to auth.uid() AND (todo owner OR list member)
DROP POLICY IF EXISTS todo_tags_insert_policy ON public.np_todo_tags;
CREATE POLICY todo_tags_insert_policy ON public.np_todo_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.np_tags tg
      WHERE tg.id = tag_id AND tg.user_id = auth.uid()
    )
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

-- DELETE: tag belongs to auth.uid()
DROP POLICY IF EXISTS todo_tags_delete_policy ON public.np_todo_tags;
CREATE POLICY todo_tags_delete_policy ON public.np_todo_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.np_tags tg
      WHERE tg.id = tag_id AND tg.user_id = auth.uid()
    )
  );
