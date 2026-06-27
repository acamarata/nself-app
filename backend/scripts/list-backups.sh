#!/usr/bin/env bash
# list-backups.sh — List available backups in Cloudflare R2
#
# Purpose:     Show the most recent 20 backups stored in R2 for ntask
# Inputs:      BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, BACKUP_ACCESS_KEY,
#              BACKUP_SECRET_KEY, BACKUP_S3_PREFIX (optional, default: ntask)
# Outputs:     Date, size, and S3 key for each backup (most recent first)
# SPORT:       K-S3-T06

set -euo pipefail

: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_ACCESS_KEY:?BACKUP_ACCESS_KEY is required}"
: "${BACKUP_SECRET_KEY:?BACKUP_SECRET_KEY is required}"

export AWS_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"

echo "[list-backups] Backups in s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-ntask}/ (most recent 20):"
echo ""

aws s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-ntask}/" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  | sort -r \
  | head -20
