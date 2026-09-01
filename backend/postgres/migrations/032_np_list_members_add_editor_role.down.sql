-- Down for 032_np_list_members_add_editor_role.sql
-- NOT YET APPLIED (see the .sql file's header) — provided for completeness.
--
-- Restores the pre-032 role vocabulary. Only roll this back alongside
-- re-reverting 031 and the collab-ops.ts editor mapping — with 031 applied
-- and this rolled back, any existing 'editor' member rows would violate the
-- narrowed CHECK, so existing editor rows are demoted to 'member' first.

UPDATE public.np_list_members SET role = 'member' WHERE role = 'editor';

DO $$
DECLARE
  existing_conname TEXT;
BEGIN
  SELECT con.conname INTO existing_conname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'np_list_members'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LIMIT 1;

  IF existing_conname IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.np_list_members DROP CONSTRAINT %I',
      existing_conname
    );
  END IF;

  ALTER TABLE public.np_list_members
    ADD CONSTRAINT np_list_members_role_check
      CHECK (role IN ('owner', 'admin', 'member'));
END $$;

COMMENT ON COLUMN public.np_list_members.role IS NULL;
