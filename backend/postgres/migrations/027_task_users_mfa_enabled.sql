-- Migration 027: task_users.mfa_enabled — server-visible MFA state
--
-- Purpose:
--   P2 fix — the web SecurityTab only tracked MFA enabled/disabled client
--   side (from the TOTP setup flow's local state), so a page reload or a
--   second device had no way to know the account's real MFA status.
--   enableMfa/disableMfa (functions/account-ops.ts) already log activity
--   rows to np_account_activity but never persisted a queryable flag.
--
--   This adds task_users.mfa_enabled as the server source of truth. The
--   action handlers are updated (same commit) to set it true/false on
--   success. Hasura metadata (tables.yaml) exposes it to role `user` via
--   select_permissions so the client can read real server state.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Safe to re-run.

ALTER TABLE public.task_users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.task_users.mfa_enabled IS
  'Server-side mirror of hasura-auth TOTP MFA state, set by enableMfa/disableMfa action handlers (functions/account-ops.ts). Source of truth for SecurityTab.';
