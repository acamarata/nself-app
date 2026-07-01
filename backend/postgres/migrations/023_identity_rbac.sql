-- Migration 023: Identity mirror + dynamic RBAC + task_users + owner immutability
--
-- Purpose:
--   1. public.users       — synced mirror of auth.users (trigger-maintained)
--   2. public.user_emails — alias / secondary email table per user
--   3. public.roles       — app RBAC roles (key-based, seeded)
--   4. public.permissions — named capability tokens
--   5. public.role_permissions — M:M linking roles to permissions
--   6. public.user_roles  — app-level role assignments; triggers sync auth.user_roles
--   7. public.task_users  — per-app user profile (migrated from np_profiles)
--   8. Owner immutability — DB-enforced triggers blocking edit/delete of owner
--
-- Strategy:
--   - auth.roles / auth.user_roles are the JWT source (hasura-auth reads them).
--     Our public.user_roles is the authoritative app-side store; triggers keep
--     auth.user_roles in sync so JWTs include the right x-hasura-allowed-roles.
--   - np_profiles data is copied to task_users; np_profiles stays as-is (no drop).
--   - All CREATE statements use IF NOT EXISTS. Triggers use CREATE OR REPLACE.
--     Safe to re-run (idempotent).
-- Constraints: ON_ERROR_STOP=1, single transaction per db-migrate.sh

-- ============================================================================
-- 1. REGISTER OUR ROLES IN auth.roles (JWT layer)
-- ============================================================================
-- hasura-auth only allows roles that exist in auth.roles in allowed-roles.
-- Insert our 7 roles; me/user/anonymous already exist.
INSERT INTO auth.roles (role) VALUES
  ('owner'),
  ('admin'),
  ('mod'),
  ('dev'),
  ('support'),
  ('guest')
ON CONFLICT (role) DO NOTHING;

-- ============================================================================
-- 2. public.users — mirror of auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  display_name TEXT        NOT NULL DEFAULT '',
  avatar_url   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

COMMENT ON TABLE public.users IS
  'Read-only mirror of auth.users kept in sync by trigger. App tables FK here.';

-- Trigger function: insert or update public.users when auth.users changes
CREATE OR REPLACE FUNCTION public.sync_auth_users_to_public()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.users (id, email, display_name, avatar_url, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.display_name, ''), split_part(NEW.email, '@', 1)),
      COALESCE(NEW.avatar_url, ''),
      NEW.created_at,
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email        = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url   = EXCLUDED.avatar_url,
      updated_at   = now();
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.users SET
      email        = NEW.email,
      display_name = COALESCE(NULLIF(NEW.display_name, ''), split_part(NEW.email, '@', 1)),
      avatar_url   = COALESCE(NEW.avatar_url, ''),
      updated_at   = now()
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    -- CASCADE on FK handles delete; this is a safety net
    DELETE FROM public.users WHERE id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_sync ON auth.users;
CREATE TRIGGER trg_auth_users_sync
  AFTER INSERT OR UPDATE OR DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_users_to_public();

-- Back-fill: sync any existing auth.users rows into public.users
INSERT INTO public.users (id, email, display_name, avatar_url, created_at)
SELECT
  id,
  email,
  COALESCE(NULLIF(display_name, ''), split_part(email, '@', 1)),
  COALESCE(avatar_url, ''),
  created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email        = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  avatar_url   = EXCLUDED.avatar_url,
  updated_at   = now();

-- ============================================================================
-- 3. public.user_emails — alias / secondary email table
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.user_emails (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email      CITEXT      NOT NULL,
  is_primary BOOLEAN     NOT NULL DEFAULT false,
  verified   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_emails_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON public.user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_email   ON public.user_emails(email);

COMMENT ON TABLE public.user_emails IS
  'Alias / secondary email addresses per user. is_primary mirrors auth.users.email.';

-- Back-fill primary emails from existing auth.users
INSERT INTO public.user_emails (user_id, email, is_primary, verified)
SELECT id, email::citext, true, email_verified
FROM auth.users
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 4. public.roles — app RBAC roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  is_system    BOOLEAN     NOT NULL DEFAULT false,
  is_immutable BOOLEAN     NOT NULL DEFAULT false,
  rank         INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roles_key_unique UNIQUE (key)
);

COMMENT ON TABLE public.roles IS
  'Application RBAC roles. is_immutable=true rows cannot be modified or deleted (enforced by trigger).';

-- ============================================================================
-- 5. public.permissions — capability tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'general',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permissions_key_unique UNIQUE (key)
);

COMMENT ON TABLE public.permissions IS 'Named capability tokens assigned to roles.';

-- ============================================================================
-- 6. public.role_permissions — M:M
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================================
-- 7. public.user_roles — app-side role assignments (source of truth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id    UUID        NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  granted_by UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

COMMENT ON TABLE public.user_roles IS
  'App RBAC assignments. Trigger syncs to auth.user_roles so JWTs include the role.';

-- Trigger: sync public.user_roles → auth.user_roles for JWT emission
-- hasura-auth reads auth.user_roles to build x-hasura-allowed-roles.
CREATE OR REPLACE FUNCTION public.sync_user_roles_to_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role_key TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT key INTO v_role_key FROM public.roles WHERE id = NEW.role_id;
    IF v_role_key IS NOT NULL THEN
      INSERT INTO auth.roles (role) VALUES (v_role_key) ON CONFLICT (role) DO NOTHING;
      INSERT INTO auth.user_roles (user_id, role)
        VALUES (NEW.user_id, v_role_key)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT key INTO v_role_key FROM public.roles WHERE id = OLD.role_id;
    IF v_role_key IS NOT NULL THEN
      DELETE FROM auth.user_roles WHERE user_id = OLD.user_id AND role = v_role_key;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_sync ON public.user_roles;
CREATE TRIGGER trg_user_roles_sync
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_roles_to_auth();

-- ============================================================================
-- 8. public.task_users — per-app user profile (replaces np_profiles role)
-- ============================================================================
-- np_profiles stays in place (not dropped); task_users is the new canonical store.
-- Existing app code using np_profiles continues to work during transition.
CREATE TABLE IF NOT EXISTS public.task_users (
  user_id              UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  display_name         TEXT        NOT NULL DEFAULT '',
  avatar_url           TEXT        NOT NULL DEFAULT '',
  prefs                JSONB       NOT NULL DEFAULT '{}',
  onboarding_done      BOOLEAN     NOT NULL DEFAULT false,
  timezone             TEXT        NOT NULL DEFAULT 'UTC',
  time_format          TEXT        NOT NULL DEFAULT '12h' CHECK (time_format IN ('12h','24h')),
  auto_hide_completed  BOOLEAN     NOT NULL DEFAULT false,
  default_list_id      UUID        REFERENCES public.np_lists(id) ON DELETE SET NULL,
  notification_settings JSONB      NOT NULL DEFAULT '{"push":true,"email":true,"new_todo":true,"shared_lists":true,"due_reminders":true,"evening_reminder":true,"evening_reminder_time":"20:00"}',
  theme_preference     TEXT        NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('light','dark','system')),
  tos_accepted_at      TIMESTAMPTZ,
  tos_version          TEXT        NOT NULL DEFAULT '1.0',
  source_account_id    TEXT        NOT NULL DEFAULT 'primary',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_users_source_account ON public.task_users(source_account_id);

COMMENT ON TABLE public.task_users IS
  'Per-app user profile for ɳTasks. Migrated from np_profiles. np_profiles kept for backward compat.';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_task_users()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_users_updated_at ON public.task_users;
CREATE TRIGGER trg_task_users_updated_at
  BEFORE UPDATE ON public.task_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_task_users();

-- Migrate existing np_profiles data into task_users (idempotent)
INSERT INTO public.task_users (
  user_id, display_name, avatar_url, time_format, auto_hide_completed,
  default_list_id, notification_settings, theme_preference,
  tos_accepted_at, tos_version, source_account_id, created_at
)
SELECT
  id, COALESCE(display_name, ''), COALESCE(avatar_url, ''),
  COALESCE(time_format, '12h'), COALESCE(auto_hide_completed, false),
  default_list_id,
  COALESCE(notification_settings, '{"push":true,"email":true,"new_todo":true,"shared_lists":true,"due_reminders":true,"evening_reminder":true,"evening_reminder_time":"20:00"}'),
  COALESCE(theme_preference, 'system'),
  tos_accepted_at, COALESCE(tos_version, '1.0'),
  COALESCE(source_account_id, 'primary'),
  COALESCE(created_at, now())
FROM public.np_profiles
ON CONFLICT (user_id) DO UPDATE SET
  display_name          = EXCLUDED.display_name,
  avatar_url            = EXCLUDED.avatar_url,
  time_format           = EXCLUDED.time_format,
  auto_hide_completed   = EXCLUDED.auto_hide_completed,
  default_list_id       = EXCLUDED.default_list_id,
  notification_settings = EXCLUDED.notification_settings,
  theme_preference      = EXCLUDED.theme_preference,
  tos_accepted_at       = EXCLUDED.tos_accepted_at,
  tos_version           = EXCLUDED.tos_version,
  source_account_id     = EXCLUDED.source_account_id,
  updated_at            = now();

-- ============================================================================
-- 9. OWNER IMMUTABILITY TRIGGERS
-- ============================================================================

-- 9a. Block key change / deletion of immutable roles in public.roles.
--     Allows UPDATE of mutable fields (name, description, rank) on immutable roles.
--     Blocks: DELETE of any immutable role; change of is_immutable→false; change of key.
CREATE OR REPLACE FUNCTION public.guard_immutable_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_immutable THEN
    RAISE EXCEPTION 'Role "%" is immutable and cannot be deleted.', OLD.key
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_immutable THEN
    -- Block: stripping immutability, or changing the role key
    IF NEW.is_immutable = false THEN
      RAISE EXCEPTION 'Cannot strip is_immutable from role "%".', OLD.key
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.key <> OLD.key THEN
      RAISE EXCEPTION 'Cannot rename immutable role "%" key.', OLD.key
        USING ERRCODE = 'P0001';
    END IF;
    -- Other field changes (name, description, rank) are allowed.
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_immutable_role ON public.roles;
CREATE TRIGGER trg_guard_immutable_role
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_role();

-- 9b. Block removal of owner role from owner users in public.user_roles
--     Allows: system/migration (no JWT context, i.e. hasura.user not set)
--     Blocks: any Hasura-context request (acting user set), regardless of who they are
--     Rationale: owner role removal is a superadmin-level DB operation only.
--     The only safe path is via direct DB access (nself CLI / migration).
CREATE OR REPLACE FUNCTION public.guard_owner_user_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_key    TEXT;
  v_acting_uid  UUID;
  v_hasura_ctx  TEXT;
BEGIN
  -- Only guard the 'owner' role
  SELECT key INTO v_role_key FROM public.roles WHERE id = OLD.role_id;
  IF v_role_key IS NULL OR v_role_key <> 'owner' THEN
    RETURN OLD;
  END IF;

  -- Check if running in a Hasura/app context (hasura.user session variable set)
  v_hasura_ctx := current_setting('hasura.user', true);
  IF v_hasura_ctx IS NULL OR v_hasura_ctx = '' THEN
    -- System / migration context (no JWT) — allow
    RETURN OLD;
  END IF;

  -- Any Hasura-context request trying to remove the owner role is blocked
  RAISE EXCEPTION 'Cannot remove the owner role via application context. Owner immutability enforced. Use a direct DB migration if intentional.'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_owner_user_role ON public.user_roles;
CREATE TRIGGER trg_guard_owner_user_role
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_user_role();

-- 9c. Block disable/delete of owner accounts in auth.users when in Hasura/app context.
--     System/migration context (no hasura.user) is always allowed.
CREATE OR REPLACE FUNCTION public.guard_owner_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_owner   BOOLEAN;
  v_hasura_ctx TEXT;
BEGIN
  -- Only block when running in a Hasura/app request context
  v_hasura_ctx := current_setting('hasura.user', true);
  IF v_hasura_ctx IS NULL OR v_hasura_ctx = '' THEN
    -- System / migration context — allow
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if this auth.users row has owner role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = OLD.id AND r.key = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete an owner account via application context. Owner immutability enforced.'
      USING ERRCODE = 'P0001';
  END IF;

  -- On UPDATE: block disabling the account
  IF TG_OP = 'UPDATE' AND NEW.disabled = true AND OLD.disabled = false THEN
    RAISE EXCEPTION 'Cannot disable an owner account via application context. Owner immutability enforced.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_owner_auth_user ON auth.users;
CREATE TRIGGER trg_guard_owner_auth_user
  BEFORE UPDATE OR DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_auth_user();

-- 9d. Block UPDATE of owner rows in public.user_roles when in Hasura/app context.
CREATE OR REPLACE FUNCTION public.guard_owner_user_role_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_key   TEXT;
  v_hasura_ctx TEXT;
BEGIN
  v_hasura_ctx := current_setting('hasura.user', true);
  IF v_hasura_ctx IS NULL OR v_hasura_ctx = '' THEN
    RETURN NEW;  -- system / migration — allow
  END IF;
  SELECT key INTO v_role_key FROM public.roles WHERE id = OLD.role_id;
  IF v_role_key = 'owner' THEN
    RAISE EXCEPTION 'Cannot modify an owner user_roles row via application context. System context (DB migration) required.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_owner_user_role_update ON public.user_roles;
CREATE TRIGGER trg_guard_owner_user_role_update
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_user_role_update();

-- ============================================================================
-- 10. auth.users default_role sync for owner
-- ============================================================================
-- When owner role is assigned via public.user_roles, also set auth.users.default_role.
CREATE OR REPLACE FUNCTION public.sync_owner_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role_key TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT key INTO v_role_key FROM public.roles WHERE id = NEW.role_id;
    IF v_role_key = 'owner' THEN
      UPDATE auth.users SET default_role = 'owner' WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT key INTO v_role_key FROM public.roles WHERE id = OLD.role_id;
    IF v_role_key = 'owner' THEN
      -- Revert to 'user' default when owner role removed
      UPDATE auth.users SET default_role = 'user' WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_owner_default_role ON public.user_roles;
CREATE TRIGGER trg_sync_owner_default_role
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_owner_default_role();

-- ============================================================================
-- 11. Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_users     ENABLE ROW LEVEL SECURITY;

-- public.users: select own row; owner can see all (hasura bypasses RLS for owner)
DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users FOR SELECT USING (id = auth.uid());

-- public.user_emails: select own emails
DROP POLICY IF EXISTS user_emails_select_self ON public.user_emails;
CREATE POLICY user_emails_select_self ON public.user_emails FOR SELECT USING (user_id = auth.uid());

-- public.roles: all authenticated users can read roles
DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- public.permissions: all authenticated users can read
DROP POLICY IF EXISTS perms_select_authenticated ON public.permissions;
CREATE POLICY perms_select_authenticated ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- public.role_permissions: all authenticated users can read
DROP POLICY IF EXISTS role_perms_select_authenticated ON public.role_permissions;
CREATE POLICY role_perms_select_authenticated ON public.role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- public.user_roles: select own rows
DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;
CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- public.task_users: select/update own row
DROP POLICY IF EXISTS task_users_select_self ON public.task_users;
CREATE POLICY task_users_select_self ON public.task_users FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS task_users_update_self ON public.task_users;
CREATE POLICY task_users_update_self ON public.task_users FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS task_users_insert_self ON public.task_users;
CREATE POLICY task_users_insert_self ON public.task_users FOR INSERT WITH CHECK (user_id = auth.uid());
