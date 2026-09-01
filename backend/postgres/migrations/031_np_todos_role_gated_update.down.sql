-- Down migration paired with 031_np_todos_role_gated_update.sql
-- NOT YET APPLIED (see the .sql file's header) — provided for completeness.
-- Restores the pre-031 membership-only policy this migration replaces.
-- Rolling back reintroduces the privilege gap described in 031's header —
-- only do this alongside re-reverting the collab-ops.ts invite-role fix.

DROP POLICY IF EXISTS "Members can update todos" ON public.np_todos;
CREATE POLICY "Members can update todos"
  ON public.np_todos
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_todos.list_id AND m.user_id = auth.uid()
    )
  );
