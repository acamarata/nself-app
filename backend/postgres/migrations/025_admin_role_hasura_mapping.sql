-- Migration 025: admin role Hasura-name mapping
--
-- Purpose:
--   Hasura (both CE and Cloud) reserves the literal role name "admin" for the
--   implicit bypass role granted to admin-secret-authenticated requests —
--   `replace_metadata`/`create_select_permission` etc. all reject
--   `"role": "admin"` with "cannot define permission for admin role". Our app
--   RBAC already has an app-level role keyed 'admin' (seeded in migration 023
--   / postgres/seed/001_roles_permissions.sql) that predates discovering this
--   constraint while wiring Hasura permissions (P103, this ticket).
--
--   Rather than renaming the app-facing role everywhere (key, UI copy, seed
--   users, docs), we add a `hasura_role` column to public.roles: the string
--   actually sent to Hasura as x-hasura-role / x-hasura-allowed-roles. It is
--   equal to `key` for every role except 'admin', which maps to 'app_admin'.
--   The sync trigger (sync_user_roles_to_auth, from migration 023) is updated
--   to insert hasura_role (not key) into auth.roles / auth.user_roles, since
--   those tables are what hasura-auth reads to build the JWT.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION, re-sync
--   backfill uses ON CONFLICT DO NOTHING / DELETE-then-INSERT. Safe to re-run.

-- ============================================================================
-- 1. Add hasura_role column, default = key, override for 'admin'
-- ============================================================================
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS hasura_role TEXT;

UPDATE public.roles SET hasura_role = COALESCE(hasura_role, key) WHERE hasura_role IS NULL;
UPDATE public.roles SET hasura_role = 'app_admin' WHERE key = 'admin';

ALTER TABLE public.roles ALTER COLUMN hasura_role SET NOT NULL;

COMMENT ON COLUMN public.roles.hasura_role IS
  'Role string actually sent to Hasura as x-hasura-role. Equal to key for every '
  'role except admin -> app_admin (Hasura reserves the literal "admin" role name '
  'for the admin-secret bypass role and refuses to accept permissions for it).';

-- Auto-derive hasura_role on INSERT (and on UPDATE of key) whenever the
-- caller doesn't set it explicitly, so existing/unmodified callers —
-- postgres/seed/001_roles_permissions.sql in particular, which INSERTs
-- (key, name, description, is_system, is_immutable, rank) only — keep
-- working without every insert site needing to know about this mapping.
CREATE OR REPLACE FUNCTION public.derive_hasura_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hasura_role IS NULL THEN
    NEW.hasura_role := CASE WHEN NEW.key = 'admin' THEN 'app_admin' ELSE NEW.key END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_hasura_role ON public.roles;
CREATE TRIGGER trg_derive_hasura_role
  BEFORE INSERT OR UPDATE OF key ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.derive_hasura_role();

-- ============================================================================
-- 2. Register app_admin (not admin) in auth.roles for the JWT layer
-- ============================================================================
INSERT INTO auth.roles (role)
SELECT DISTINCT hasura_role FROM public.roles
ON CONFLICT (role) DO NOTHING;

-- ============================================================================
-- 3. Re-sync existing user_roles rows: replace any 'admin' rows in
--    auth.user_roles with 'app_admin' (idempotent re-derivation from
--    public.user_roles, the source of truth).
-- ============================================================================
DELETE FROM auth.user_roles WHERE role = 'admin';

INSERT INTO auth.user_roles (user_id, role)
SELECT ur.user_id, r.hasura_role
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- 4. Update sync trigger to use hasura_role instead of key
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_user_roles_to_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hasura_role TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT hasura_role INTO v_hasura_role FROM public.roles WHERE id = NEW.role_id;
    IF v_hasura_role IS NOT NULL THEN
      INSERT INTO auth.roles (role) VALUES (v_hasura_role) ON CONFLICT (role) DO NOTHING;
      INSERT INTO auth.user_roles (user_id, role)
        VALUES (NEW.user_id, v_hasura_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT hasura_role INTO v_hasura_role FROM public.roles WHERE id = OLD.role_id;
    IF v_hasura_role IS NOT NULL THEN
      DELETE FROM auth.user_roles WHERE user_id = OLD.user_id AND role = v_hasura_role;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
-- Trigger itself (trg_user_roles_sync) already exists from migration 023 and
-- points at this function name — CREATE OR REPLACE above is sufficient,
-- no DROP/CREATE TRIGGER needed.

-- ============================================================================
-- 5. auth.users.default_role: owner sync trigger (sync_owner_default_role)
--    is untouched — 'owner' is unaffected by this mapping (only 'admin' is
--    remapped). No default_role uses 'admin' as a Hasura role value anywhere;
--    default_role is a separate hasura-auth concept (not the same reserved
--    word as Hasura engine's admin bypass role), so it is fine as-is.
-- ============================================================================
