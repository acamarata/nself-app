-- 05-np-plugins-seed.sql
-- ntask canonical free plugin set.
-- Source of truth: backend/nself.yaml (see Epic H-S1-T3).
-- Do not add pro plugins here. ntask uses free plugins only — no license key required.
--
-- Idempotent: ON CONFLICT (name) DO NOTHING. Safe to re-run.
-- Every plugin name below exists as a directory under plugins/free/.

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('auth',          '1.0.0', 'free', '{"description": "Hasura Auth: email/password + OAuth user management"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('storage',       '1.0.0', 'free', '{"description": "Hasura Storage: S3-compatible file storage via MinIO"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('cron',          '1.0.0', 'free', '{"description": "Scheduled task runner: recurring task evaluation and cron jobs"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('notify',        '1.0.0', 'free', '{"description": "Notification dispatch: route and deliver in-app and push notifications"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('notifications', '1.0.0', 'free', '{"description": "Push notification delivery: FCM/APNs device push support"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('jobs',          '1.0.0', 'free', '{"description": "Background job queue: async task processing and retries"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('search',        '1.0.0', 'free', '{"description": "Full-text task search: Postgres tsvector-backed search index"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('feature-flags', '1.0.0', 'free', '{"description": "Feature rollout control: per-user and global flag evaluation"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('audit-log',     '1.0.0', 'free', '{"description": "Audit trail: tamper-evident log of task and list mutations"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('webhooks',      '1.0.0', 'free', '{"description": "Outbound webhook delivery: HTTP callbacks on task/list events"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('invitations',   '1.0.0', 'free', '{"description": "User invite flow: email-based list sharing invitations"}')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO np_plugins (name, version, tier, metadata)
  VALUES ('tokens',        '1.0.0', 'free', '{"description": "API token management: scoped long-lived tokens for integrations"}')
  ON CONFLICT (name) DO NOTHING;
