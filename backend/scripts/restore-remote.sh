#!/usr/bin/env bash
# restore-remote.sh — Download from R2 and restore Postgres backup
#
# Purpose:     Disaster recovery restore from Cloudflare R2 to a target database
# Inputs:      FILE (S3 key), DATABASE_URL, BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT,
#              BACKUP_ACCESS_KEY, BACKUP_SECRET_KEY
# Usage:       FILE=ntask/backup-20260101-030000.sql.gz make restore-remote
#              FILE=ntask/backup-20260101-030000.sql.gz bash scripts/restore-remote.sh
# Constraints: Target DB must be empty or a scratch/DR instance.
#              NEVER run against prod without explicit authorization.
# SPORT:       K-S3-T06, K-S3-T07

set -euo pipefail

: "${FILE:?FILE is required — specify the S3 key to restore, e.g. ntask/backup-20260101-030000.sql.gz}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_ACCESS_KEY:?BACKUP_ACCESS_KEY is required}"
: "${BACKUP_SECRET_KEY:?BACKUP_SECRET_KEY is required}"

export AWS_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"

echo "[restore-remote] Downloading: s3://${BACKUP_S3_BUCKET}/${FILE}"
echo "[restore-remote] Target:      ${DATABASE_URL%%@*}@<host-redacted>"

aws s3 cp "s3://${BACKUP_S3_BUCKET}/${FILE}" - \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --no-progress \
| gunzip \
| psql "$DATABASE_URL"

echo "[restore-remote] Restore complete from ${FILE}"
