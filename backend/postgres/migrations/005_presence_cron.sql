-- Migration 005: Stale presence cleanup via pg_cron
-- T-0565: Removes rows where last_seen_at > 35 seconds ago every 30 seconds.
-- Requires pg_cron extension (available in PostgreSQL 14+ with the pg_cron package).
-- nself installs pg_cron automatically when using the cron plugin, or it can be
-- enabled manually: `CREATE EXTENSION IF NOT EXISTS pg_cron;`

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Efficient cleanup index (already created by init.sql, included here for safety)
CREATE INDEX IF NOT EXISTS idx_np_list_presence_last_seen
  ON public.np_list_presence(last_seen_at);

-- Schedule cleanup every 30 seconds.
-- Uses 5-second grace period to avoid flicker on slow clients.
SELECT cron.schedule(
  'ntasks-cleanup-stale-presence',
  '30 seconds',
  $$
    DELETE FROM public.np_list_presence
    WHERE last_seen_at < NOW() - INTERVAL '35 seconds';
  $$
);
