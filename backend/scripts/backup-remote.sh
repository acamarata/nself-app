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

# Configure AWS CLI for R2 (S3-compatible)
export AWS_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"

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
# Backup — stream pg_dump | gzip | aws s3 cp (never touches disk)
# ---------------------------------------------------------------------------
echo "[backup-remote] Starting backup at ${TIMESTAMP}"
echo "[backup-remote] Target: s3://${BACKUP_S3_BUCKET}/${BACKUP_KEY}"

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip \
  | aws s3 cp - "s3://${BACKUP_S3_BUCKET}/${BACKUP_KEY}" \
      --endpoint-url "$BACKUP_S3_ENDPOINT" \
      --no-progress

echo "[backup-remote] Backup completed: ${BACKUP_KEY}"

# ---------------------------------------------------------------------------
# Retention cleanup — delete objects older than RETENTION_DAYS
# ---------------------------------------------------------------------------
echo "[backup-remote] Cleaning up backups older than ${RETENTION_DAYS} days..."

# Date arithmetic: GNU date vs macOS date
CUTOFF_DATE=$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v -${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%SZ)

aws s3api list-objects-v2 \
  --bucket "$BACKUP_S3_BUCKET" \
  --prefix "${BACKUP_S3_PREFIX:-ntask}/" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --query "Contents[?LastModified<='${CUTOFF_DATE}'].[Key]" \
  --output text \
| while IFS= read -r key; do
    if [[ -n "$key" && "$key" != "None" ]]; then
      echo "[backup-remote] Deleting old backup: $key"
      aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" \
        --endpoint-url "$BACKUP_S3_ENDPOINT"
    fi
  done

echo "[backup-remote] Retention cleanup complete."
echo "[backup-remote] Done."
