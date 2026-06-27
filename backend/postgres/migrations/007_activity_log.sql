-- T-0589: Activity log table
-- Stores audit trail of all task mutations (create, update, complete, assign)

CREATE TABLE IF NOT EXISTS public.np_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id     UUID NOT NULL REFERENCES public.np_todos(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,             -- 'created' | 'updated' | 'completed' | 'assigned' | 'deleted'
  metadata    JSONB,                     -- e.g. { "field": "priority", "old": "none", "new": "high" }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS np_activity_todo_id_idx ON public.np_activity(todo_id);
CREATE INDEX IF NOT EXISTS np_activity_actor_id_idx ON public.np_activity(actor_id);
CREATE INDEX IF NOT EXISTS np_activity_created_at_idx ON public.np_activity(created_at DESC);

-- Enable RLS
ALTER TABLE public.np_activity ENABLE ROW LEVEL SECURITY;

-- List/todo owners can see activity on their todos
CREATE POLICY "activity_select" ON public.np_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.np_todos t
      WHERE t.id = todo_id
        AND (
          t.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.np_list_shares ls
            WHERE ls.list_id = t.list_id AND ls.shared_with_user_id = auth.uid()
          )
        )
    )
  );

-- Only actors can insert their own activity
CREATE POLICY "activity_insert" ON public.np_activity
  FOR INSERT WITH CHECK (actor_id = auth.uid());
