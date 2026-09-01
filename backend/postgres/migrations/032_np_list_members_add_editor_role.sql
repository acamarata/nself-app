-------------------------------------------------------------------------------
-- Migration 032: Add 'editor' to the np_list_members role vocabulary
--
-- MUST be applied together with (or before) 031_np_todos_role_gated_update.sql.
-- Neither is applied to any database yet.
--
-- WHY THIS IS NEEDED
-- Migration 031 rewrites "Members can update todos" so a member may UPDATE a
-- todo only when they own it, are an assignee, OR their np_list_members.role
-- is anything other than plain 'member' (i.e. `m.role <> 'member'`). That
-- predicate is what is meant to grant an editor edit rights on todos they
-- neither own nor are assigned to.
--
-- But np_list_members.role (002_add_task_approval_system.sql) only allows
-- ('owner', 'admin', 'member') — there is no 'editor' value, and 'admin'
-- carries approval authority + member management that an editor invite was
-- never meant to grant (that over-grant was the original incident,
-- 2026-08-31). collab-ops.ts's invite-role mapping is being fixed in this
-- same change to write 'editor' rows for editor invites; the pre-032 CHECK
-- constraint would reject every one of those inserts.
--
-- Net effect if this migration is skipped while 031 + the collab-ops.ts
-- mapping ship: 'editor' invites fail to insert (CHECK violation) and the
-- accept-invite action breaks for every editor invitee. If only the mapping
-- ships without 031, editors are silently demoted to viewers, which is the
-- state this whole change is fixing. 031 and 032 are one unit; deploy both
-- together, in either order (032 first is safest — 031 does not depend on
-- new rows existing yet, only on the CHECK permitting them).
--
-- APPROACH
-- 002 declares `role` with an inline column CHECK, so Postgres auto-names
-- the constraint `<table>_<column>_check` — conventionally
-- np_list_members_role_check (confirmed against this repo's own convention,
-- e.g. np_todos_priority_check in 003_ntasks_complete_schema.sql). Rather
-- than assume that name, look it up from pg_constraint by shape (a CHECK
-- constraint on public.np_list_members whose definition mentions the role
-- column) and drop whatever is actually there. This is idempotent and safe
-- to re-run: if the constraint has already been widened (definition already
-- contains 'editor'), it is left alone.
-------------------------------------------------------------------------------

DO $$
DECLARE
  existing_conname TEXT;
  existing_condef TEXT;
BEGIN
  SELECT con.conname, pg_get_constraintdef(con.oid)
    INTO existing_conname, existing_condef
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'np_list_members'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LIMIT 1;

  IF existing_conname IS NULL THEN
    -- No existing role CHECK found (unexpected, but don't fail silently) —
    -- add the widened constraint under the conventional name.
    ALTER TABLE public.np_list_members
      ADD CONSTRAINT np_list_members_role_check
        CHECK (role IN ('owner', 'admin', 'editor', 'member'));
  ELSIF existing_condef NOT ILIKE '%editor%' THEN
    EXECUTE format(
      'ALTER TABLE public.np_list_members DROP CONSTRAINT %I',
      existing_conname
    );
    ALTER TABLE public.np_list_members
      ADD CONSTRAINT np_list_members_role_check
        CHECK (role IN ('owner', 'admin', 'editor', 'member'));
  END IF;
  -- Else: already widened (definition contains 'editor') — nothing to do.
END $$;

COMMENT ON COLUMN public.np_list_members.role IS
  'owner | admin | editor | member. editor added in migration 032 to give invited collaborators edit rights on all list todos (see 031_np_todos_role_gated_update.sql m.role <> ''member'' predicate) without granting admin''s member-management/approval authority.';
