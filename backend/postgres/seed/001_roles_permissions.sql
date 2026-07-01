-- seed/001_roles_permissions.sql
-- Purpose: Seed roles, permissions, and role_permissions on ALL environments.
-- Idempotent: safe to re-run multiple times.
-- Called by: scripts/seed-prod.sh, scripts/seed-dev.sh (after migration 023 applied).
--
-- IMPORTANT: The guard_immutable_role trigger blocks key changes on immutable roles.
-- We use ON CONFLICT DO NOTHING for immutable roles (owner) and DO UPDATE for mutable ones.

-- ============================================================================
-- ROLES (immutable ones: DO NOTHING; mutable ones: DO UPDATE)
-- ============================================================================

-- owner role: immutable — never update key/is_immutable (trigger guards it)
INSERT INTO public.roles (key, name, description, is_system, is_immutable, rank)
VALUES ('owner', 'Owner', 'Superuser — full access, immutable. Belongs to Aric.', true, true, 100)
ON CONFLICT (key) DO NOTHING;

-- mutable system roles — update name/description/rank if they change
INSERT INTO public.roles (key, name, description, is_system, is_immutable, rank)
VALUES
  ('admin',   'Admin',   'All admin features except owner-only specials.',                         true, false,  80),
  ('mod',     'Mod',     'Content moderation.',                                                    true, false,  60),
  ('dev',     'Dev',     'Developer/debug tooling.',                                               true, false,  50),
  ('support', 'Support', 'Support tooling — read-mostly.',                                         true, false,  40),
  ('user',    'User',    'Authenticated user — has account. Default role on signup.',              true, false,  10),
  ('guest',   'Guest',   'Anonymous (not logged in). Maps to Hasura public/anonymous role.',      true, false,   0)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system   = EXCLUDED.is_system,
  rank        = EXCLUDED.rank;
-- NOTE: is_immutable stays false for these; trigger would block any attempt to set it true here.

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
INSERT INTO public.permissions (key, name, description, category)
VALUES
  ('users.manage',     'Manage Users',       'Create, update, delete, suspend user accounts.',      'users'),
  ('roles.manage',     'Manage Roles',       'Assign and revoke roles for any user.',               'rbac'),
  ('perms.manage',     'Manage Permissions', 'Edit role-permission assignments.',                    'rbac'),
  ('content.manage',   'Manage Content',     'Full CRUD on all content in all namespaces.',          'content'),
  ('content.moderate', 'Moderate Content',   'Review, hide, delete flagged content.',               'content'),
  ('admin.view',       'Admin View',         'Read-only access to the admin dashboard.',             'admin'),
  ('billing.manage',   'Manage Billing',     'View and update subscription / billing info.',         'billing'),
  ('support.view',     'Support View',       'View support tickets and user profiles.',              'support'),
  ('telemetry.view',   'View Telemetry',     'View analytics and telemetry dashboards.',             'telemetry'),
  ('system.manage',    'Manage System',      'System config, migrations, feature flags.',            'system')
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category;

-- ============================================================================
-- ROLE → PERMISSION ASSIGNMENTS
-- ============================================================================

-- owner: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.key = 'owner'
ON CONFLICT DO NOTHING;

-- admin: all permissions (same as owner currently; split when owner-specials are added)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.key = 'admin'
  AND p.key IN (
    'users.manage','roles.manage','perms.manage','content.manage',
    'content.moderate','admin.view','billing.manage','support.view',
    'telemetry.view','system.manage'
  )
ON CONFLICT DO NOTHING;

-- mod: content.moderate + admin.view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.key = 'mod'
  AND p.key IN ('content.moderate', 'admin.view')
ON CONFLICT DO NOTHING;

-- dev: admin.view + system.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.key = 'dev'
  AND p.key IN ('admin.view', 'system.manage')
ON CONFLICT DO NOTHING;

-- support: support.view + admin.view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.key = 'support'
  AND p.key IN ('support.view', 'admin.view')
ON CONFLICT DO NOTHING;

-- user: no explicit permissions (own-data access enforced via RLS + Hasura row filters)
-- guest: no explicit permissions (public-read only via Hasura unauthorized role)
