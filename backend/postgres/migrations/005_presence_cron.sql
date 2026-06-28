-- Migration 005: Stale presence cleanup
-- T-0565: Removes rows where last_seen_at > 35 seconds ago.
--
-- Scheduling strategy: Hasura cron triggers (hasura/metadata/cron_triggers.yaml)
-- drive this cleanup — pg_cron is NOT required and is NOT installed in the
-- standard postgres:16-alpine image. The pg_cron block below is guarded by a
-- DO-block so the migration succeeds on stacks that do NOT have pg_cron, while
-- still registering the job on stacks that do (e.g., CloudSQL, RDS, TimescaleDB).
--
-- On standard nSelf stacks: Hasura cron trigger 'cleanup-stale-presence' in
-- cron_triggers.yaml fires every minute via the Hasura event system, which is
-- the authoritative scheduling mechanism. The pg_cron job here is supplemental.

-- Efficient cleanup index (safe to re-run — idempotent)
CREATE INDEX IF NOT EXISTS idx_np_list_presence_last_seen
  ON public.np_list_presence(last_seen_at);

-- pg_cron scheduling: only if the extension is already available in this PG build.
-- On standard postgres:16-alpine this entire block is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    EXECUTE $inner$
      SELECT cron.schedule(
        'ntasks-cleanup-stale-presence',
        '* * * * *',
        'DELETE FROM public.np_list_presence WHERE last_seen_at < NOW() - INTERVAL ''35 seconds'''
      )
    $inner$;
  END IF;
EXCEPTION
  WHEN undefined_table    THEN NULL;  -- cron schema absent
  WHEN undefined_function THEN NULL;  -- cron.schedule absent
  WHEN others             THEN NULL;  -- any other pg_cron error
END;
$$;
