-------------------------------------------------------------------------------
-- Migration 031: Role-gate the np_todos UPDATE policy
--
-- NOT YET APPLIED TO ANY DATABASE. Prepared for review only — see PR notes.
-- Deploying this requires an owner-approved release; do not run it against
-- staging or production without that sign-off.
--
-- WHAT THIS FIXES
-- "Members can update todos" (added in 002_add_task_approval_system.sql,
-- line 319) gated UPDATE on np_list_members MEMBERSHIP only:
--
--     EXISTS (SELECT 1 FROM np_list_members m
--             WHERE m.list_id = np_todos.list_id AND m.user_id = auth.uid())
--
-- It never checked `m.role`. Chained with the invite-role mapping bug fixed
-- in this same PR (collab-ops.ts handleAcceptListInvite — an 'editor' invite
-- silently became an 'admin' member), the net effect live was: a "viewer"
-- invitee — who should have read-only access — is added as a plain 'member'
-- and can UPDATE (edit) ANY todo in the list via a direct GraphQL mutation,
-- not just todos they own or are assigned to. Confirmed live 2026-08-31.
--
-- INTERIM SEMANTICS (this migration)
-- A member may UPDATE a todo when:
--   1. they own it (np_todos.user_id = auth.uid()), OR
--   2. they are an assignee (np_todo_assignees.assignee_id = auth.uid()), OR
--   3. their np_list_members.role is anything other than plain 'member'
--      (i.e. 'owner' or 'admin').
--
-- Intent: a kid can still tick off their own assigned chore; a view-only
-- invitee cannot edit arbitrary tasks in the list. This is INTERIM, not the
-- full fix — 'editor' invites currently collapse to plain 'member' (see the
-- collab-ops.ts comment in this PR) because the member-role vocabulary
-- (owner/admin/member) has no honest "can edit, cannot manage members"
-- target yet. Introducing that role, and revisiting this policy to grant it
-- edit rights on all todos in the list (not just owned/assigned), is
-- ADR-P9-01 Wave 2.
--
-- SCOPE NOTE — other np_todos policies checked, not changed here:
--   - "Members can create todos" (INSERT) has the SAME membership-only gate,
--     but the interim rule above does not cleanly apply to INSERT: a new
--     row has no existing owner or assignee to check against, and blocking
--     plain 'member' from creating todos is a product decision (family
--     chore lists expect members/kids to be able to add their own tasks),
--     not an obvious security fix. Left as-is; flagged for ADR-P9-01 Wave 2
--     to decide deliberately rather than as a side effect of this patch.
--   - "Owners and creators can delete todos" (DELETE) already gates on
--     `m.role IN ('owner', 'admin')` — no flaw, no change needed.
--
-- A related but DIFFERENT-mechanism flaw was also found and is explicitly
-- OUT OF SCOPE for this migration: np_subtasks' SELECT/INSERT/UPDATE
-- policies (009_add_subtasks.sql) gate on np_list_shares.accepted_at IS NOT
-- NULL with no `permission` check, mirroring this same membership-without-
-- role pattern but on the separate share-link system (np_list_shares.role
-- IN ('owner','editor'), not np_list_members). That table's DELETE policy
-- already checks `ls.permission IN ('owner', 'editor')`, showing the
-- correct pattern was known but not applied consistently to
-- SELECT/INSERT/UPDATE. Needs its own review — different table, different
-- judgment call — not folded into this migration.
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can update todos" ON public.np_todos;
CREATE POLICY "Members can update todos"
  ON public.np_todos
  FOR UPDATE
  USING (
    -- Own todos
    user_id = auth.uid()
    OR
    -- Assigned to this todo
    EXISTS (
      SELECT 1 FROM public.np_todo_assignees a
      WHERE a.todo_id = np_todos.id AND a.assignee_id = auth.uid()
    )
    OR
    -- Member of the list with a role above plain 'member' (owner/admin)
    EXISTS (
      SELECT 1 FROM public.np_list_members m
      WHERE m.list_id = np_todos.list_id
        AND m.user_id = auth.uid()
        AND m.role <> 'member'
    )
  );
