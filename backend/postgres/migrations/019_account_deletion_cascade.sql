-- Migration 019: Account deletion cascade preparation
-- J-S3-T1: Backend account deletion + cascade purge
--
-- Purpose: Ensure all np_* tables that reference auth.users(id) have ON DELETE CASCADE
-- so that when hasura-auth deletes the auth user, orphan rows cannot persist.
-- The user-delete.ts function also explicitly deletes rows and MinIO objects before
-- calling the auth delete, but CASCADE is the safety net.
--
-- NOTE: Most FKs were created with ON DELETE CASCADE already (per migrations 001-018).
-- This migration audits and adds any missing CASCADE constraints.

-- np_profiles — id FK to auth.users(id) (np_profiles.id IS the user id; ensure CASCADE)
-- Note: np_profiles uses 'id' as its PK and the FK to auth.users, not a separate 'user_id'.
DO $$
BEGIN
  -- Drop + recreate only if the FK delete rule is not CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'np_profiles'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_profiles DROP CONSTRAINT IF EXISTS np_profiles_id_fkey;
    ALTER TABLE public.np_profiles
      ADD CONSTRAINT np_profiles_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- np_user_preferences — user_id FK (added in migration 003 with ON DELETE CASCADE; verify)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'np_user_preferences'
      AND kcu.column_name = 'user_id'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_user_preferences DROP CONSTRAINT IF EXISTS np_user_preferences_user_id_fkey;
    ALTER TABLE public.np_user_preferences
      ADD CONSTRAINT np_user_preferences_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- np_device_tokens — user_id FK (migration 017)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'np_device_tokens'
      AND kcu.column_name = 'user_id'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_device_tokens DROP CONSTRAINT IF EXISTS np_device_tokens_user_id_fkey;
    ALTER TABLE public.np_device_tokens
      ADD CONSTRAINT np_device_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- np_offline_outbox — user_id FK (migration 016)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'np_offline_outbox'
      AND kcu.column_name = 'user_id'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_offline_outbox DROP CONSTRAINT IF EXISTS np_offline_outbox_user_id_fkey;
    ALTER TABLE public.np_offline_outbox
      ADD CONSTRAINT np_offline_outbox_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- np_lists — owner_id FK (cascade: when user deleted, their lists go with them)
-- NOTE: This will cascade-delete all list members/shares. Intentional for account deletion.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'np_lists'
      AND kcu.column_name = 'owner_id'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_lists DROP CONSTRAINT IF EXISTS np_lists_owner_id_fkey;
    ALTER TABLE public.np_lists
      ADD CONSTRAINT np_lists_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- np_todos — user_id FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'np_todos'
      AND kcu.column_name = 'user_id'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_todos DROP CONSTRAINT IF EXISTS np_todos_user_id_fkey;
    ALTER TABLE public.np_todos
      ADD CONSTRAINT np_todos_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- np_attachments — uploader_id FK (migration 011 already sets CASCADE; idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'np_attachments'
      AND kcu.column_name = 'uploader_id'
      AND rc.delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE public.np_attachments DROP CONSTRAINT IF EXISTS np_attachments_uploader_id_fkey;
    ALTER TABLE public.np_attachments
      ADD CONSTRAINT np_attachments_uploader_id_fkey
        FOREIGN KEY (uploader_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add tos_accepted_at and tos_version to np_profiles (J-S1-T1)
-- Idempotent: IF NOT EXISTS guard prevents duplicate-column errors.
ALTER TABLE public.np_profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version      TEXT DEFAULT '1.0';

COMMENT ON COLUMN public.np_profiles.tos_accepted_at IS
  'Timestamp when user accepted the Terms of Service. NULL = not yet accepted (pre-gate users).';
COMMENT ON COLUMN public.np_profiles.tos_version IS
  'Version of ToS accepted. Current: 1.0. Must be re-accepted if ToS changes.';

CREATE INDEX IF NOT EXISTS idx_np_profiles_tos_accepted_at
  ON public.np_profiles(tos_accepted_at)
  WHERE tos_accepted_at IS NOT NULL;
