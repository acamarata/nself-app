#!/usr/bin/env bash
# backup-remote.sh — Stream pg_dump to Cloudflare R2 (S3-compatible)
#
# Purpose:     Automated off-machine Postgres backup for ntask SaaS prod/staging
# Inputs:      DATABASE_URL, BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT,
#              BACKUP_ACCESS_KEY, BACKUP_SECRET_KEY, BACKUP_RETENTION_DAYS
# Outputs:     <BACKUP_S3_BUCKET>/<BACKUP_S3_PREFIX>/backup-YYYYMMDD-HHMMSS.sql.gz in R2
# Constraints: Never store backup on local disk — stream directly to R2
#              Alerts on failure via Sentry DSN if SENTRY_DSN_BACKEND is set
# SPORT:       K-S3-T06

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_KEY="${BACKUP_S3_PREFIX:-ntask}/backup-${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Required env vars
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_ACCESS_KEY:?BACKUP_ACCESS_KEY is required}"
: "${BACKUP_SECRET_KEY:?BACKUP_SECRET_KEY is required}"

# S3 client: aws when present, else rclone. Neither nSelf box can install the
# awscli deb (Ubuntu 24.04 dropped it), which is why this indirection exists.
# shellcheck source=scripts/s3-client.sh
source "$(dirname "${BASH_SOURCE[0]}")/s3-client.sh"

# ---------------------------------------------------------------------------
# Failure handler — send Sentry alert if DSN is configured
# ---------------------------------------------------------------------------
_on_error() {
  local exit_code=$?
  echo "[backup-remote] ERROR: backup failed (exit $exit_code)" >&2

  if [[ -n "${SENTRY_DSN_BACKEND:-}" ]]; then
    local sentry_url
    sentry_url=$(echo "$SENTRY_DSN_BACKEND" \
      | sed 's|https://\([^@]*\)@\([^/]*\)/\(.*\)|https://\2/api/\3/store/|')
    local public_key
    public_key=$(echo "$SENTRY_DSN_BACKEND" \
      | sed 's|https://\([^@]*\)@.*|\1|' | cut -d: -f1)

    curl -sf -X POST "$sentry_url" \
      -H "Content-Type: application/json" \
      -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${public_key}" \
      -d "{
        \"message\": \"ntask backup-remote failed (exit ${exit_code})\",
        \"level\": \"error\",
        \"logger\": \"backup-remote\",
        \"tags\": {\"bucket\": \"${BACKUP_S3_BUCKET}\", \"timestamp\": \"${TIMESTAMP}\"}
      }" >/dev/null 2>&1 || true
    echo "[backup-remote] Sentry alert sent."
  fi

  exit "$exit_code"
}
trap '_on_error' ERR

# ---------------------------------------------------------------------------
# Backup — stream pg_dump | gzip | upload (never touches disk)
# ---------------------------------------------------------------------------
echo "[backup-remote] Starting backup at ${TIMESTAMP}"
echo "[backup-remote] Target: s3://${BACKUP_S3_BUCKET}/${BACKUP_KEY} (client: ${S3_CLIENT})"

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip \
  | s3_put_stream "$BACKUP_KEY"

echo "[backup-remote] Backup completed: ${BACKUP_KEY}"

# ---------------------------------------------------------------------------
# Retention cleanup — delete objects older than RETENTION_DAYS
# ---------------------------------------------------------------------------
echo "[backup-remote] Cleaning up backups older than ${RETENTION_DAYS} days..."

CUTOFF_EPOCH=$(( $(date -u +%s) - RETENTION_DAYS * 86400 ))

s3_list "${BACKUP_S3_PREFIX:-ntask}" \
| while read -r day time _size name; do
    [ -n "$name" ] || continue
    # Object timestamps are UTC "YYYY-MM-DD HH:MM:SS"; compare as epoch seconds
    # so this needs no date-parsing differences between GNU and BSD date.
    obj_epoch=$(date -u -d "${day} ${time}" +%s 2>/dev/null || echo 0)
    if [ "$obj_epoch" -ne 0 ] && [ "$obj_epoch" -lt "$CUTOFF_EPOCH" ]; then
      echo "[backup-remote] Deleting old backup: $name"
      s3_delete "${BACKUP_S3_PREFIX:-ntask}/${name}"
    fi
  done

echo "[backup-remote] Retention cleanup complete."
echo "[backup-remote] Done."
