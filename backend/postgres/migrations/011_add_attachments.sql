-- Migration 011: Add np_attachments table
-- Typed file-attachment rows linked to MinIO storage keys.
-- Replaces the unstructured np_todos.attachments JSONB blob (column kept deprecated).
-- comment_id allows attaching files directly to a comment thread.

CREATE TABLE IF NOT EXISTS public.np_attachments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id           UUID        NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  comment_id        UUID        REFERENCES public.np_comments(id) ON DELETE CASCADE,
  uploader_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_key       TEXT        NOT NULL,
  bucket            TEXT        NOT NULL DEFAULT 'ntask',
  file_name         TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  file_size_bytes   BIGINT      NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 104857600),
  acl               TEXT        CHECK (acl IN ('private', 'public')),
  source_account_id TEXT        NOT NULL DEFAULT 'primary',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_np_attachments_todo_id        ON public.np_attachments(todo_id);
CREATE INDEX IF NOT EXISTS idx_np_attachments_comment_id     ON public.np_attachments(comment_id)
  WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_np_attachments_uploader_id    ON public.np_attachments(uploader_id);
CREATE INDEX IF NOT EXISTS idx_np_attachments_source_account ON public.np_attachments(source_account_id);

-- Enable RLS
ALTER TABLE public.np_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: uploader OR todo owner OR list member
DROP POLICY IF EXISTS attachments_select_policy ON public.np_attachments;
CREATE POLICY attachments_select_policy ON public.np_attachments
  FOR SELECT USING (
    uploader_id = auth.uid()
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

-- INSERT: uploader must be auth.uid()
DROP POLICY IF EXISTS attachments_insert_policy ON public.np_attachments;
CREATE POLICY attachments_insert_policy ON public.np_attachments
  FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- DELETE: uploader OR todo owner OR list owner/admin
DROP POLICY IF EXISTS attachments_delete_policy ON public.np_attachments;
CREATE POLICY attachments_delete_policy ON public.np_attachments
  FOR DELETE USING (
    uploader_id = auth.uid()
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
