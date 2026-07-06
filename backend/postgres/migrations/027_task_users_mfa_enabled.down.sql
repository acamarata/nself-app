-- Down for 027_task_users_mfa_enabled.sql
ALTER TABLE public.task_users
  DROP COLUMN IF EXISTS mfa_enabled;
