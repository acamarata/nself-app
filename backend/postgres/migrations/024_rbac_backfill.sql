-- Migration 024: RBAC backfill — task_users completeness + explicit user_roles
--
-- Purpose:
--   1. task_users: complete the np_profiles -> task_users copy for any profile
--      created after migration 023 ran (e.g. test users added later via
--      seed-dev.sh). Same idempotent shape as 023's backfill.
--   2. user_roles: every user with a profile gets an EXPLICIT public.user_roles
--      row for 'user' if they have no role row at all yet. hasura-auth already
--      grants the 'user' role implicitly via auth.user_roles at signup, but
--      public.user_roles (our app-side RBAC source of truth) had no row for
--      them, so the app's own role-based checks / owner-immutability triggers
--      had nothing to see for those accounts.
--
-- Idempotent: ON CONFLICT DO NOTHING / DO UPDATE throughout. Safe to re-run.
-- Constraints: ON_ERROR_STOP=1, single transaction per db-migrate.sh.

-- ============================================================================
-- 1. Complete task_users backfill (same mapping as migration 023, section 8)
-- ============================================================================
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
  avatar_url             = EXCLUDED.avatar_url,
  time_format            = EXCLUDED.time_format,
  auto_hide_completed    = EXCLUDED.auto_hide_completed,
  default_list_id        = EXCLUDED.default_list_id,
  notification_settings  = EXCLUDED.notification_settings,
  theme_preference       = EXCLUDED.theme_preference,
  tos_accepted_at        = EXCLUDED.tos_accepted_at,
  tos_version            = EXCLUDED.tos_version,
  source_account_id      = EXCLUDED.source_account_id,
  updated_at             = now();

-- Also cover users who signed up but never got a np_profiles row (defensive;
-- public.users mirror is populated by trigger for every auth.users row).
INSERT INTO public.task_users (user_id, display_name, source_account_id)
SELECT u.id, COALESCE(u.display_name, ''), 'primary'
FROM public.users u
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 2. Explicit public.user_roles row for every user with no role row yet
-- ============================================================================
-- Default to 'user' — the same role hasura-auth already grants implicitly via
-- auth.user_roles at signup. This makes public.user_roles (our RBAC source of
-- truth) complete and consistent for every account, including seed accounts
-- added after migration 023 (user@, demo@, demo@ntask.local, test@nself.org).
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
JOIN public.roles r ON r.key = 'user'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
)
ON CONFLICT (user_id, role_id) DO NOTHING;
