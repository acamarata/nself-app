#!/usr/bin/env bash
# backup-cron.sh — the entry point cron calls on an nSelf box.
#
# Why a wrapper: cron has no environment. This resolves the project .env, reads
# the live Postgres password and published port out of the running container
# (the two drift from .env, and a stale password fails the dump at 3am with no
# one watching), then hands off to backup-remote.sh.
#
# Install (per box, as root):
#   ln -sf /opt/nself-ntask/scripts/backup-cron.sh /usr/local/bin/ntask-backup
#   crontab entry -> see .github/docs or the ticket BE-5 evidence
#
# Inputs:  NTASK_DIR (default /opt/nself-ntask)
# Outputs: appends to /var/log/ntask-backup.log; non-zero exit on failure so
#          cron's own mail/alerting sees it.
set -euo pipefail

NTASK_DIR="${NTASK_DIR:-/opt/nself-ntask}"
cd "$NTASK_DIR"

# shellcheck disable=SC1091
set -a; . ./.env; set +a

PGPASS=$(docker inspect ntask_postgres \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep '^POSTGRES_PASSWORD=' | cut -d= -f2-)
PGPORT=$(docker port ntask_postgres 5432/tcp 2>/dev/null | head -1 | sed 's/.*://')
PGDB="${POSTGRES_DB:-ntask}"

: "${PGPASS:?could not read POSTGRES_PASSWORD from the running ntask_postgres}"
: "${PGPORT:?ntask_postgres does not publish 5432 on the host}"

export DATABASE_URL="postgresql://postgres:${PGPASS}@127.0.0.1:${PGPORT}/${PGDB}"
exec bash "$NTASK_DIR/scripts/backup-remote.sh"
