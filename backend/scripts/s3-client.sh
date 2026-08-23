#!/usr/bin/env bash
# s3-client.sh — one S3/R2 client abstraction for the backup scripts.
#
# Why this exists:
#   backup-remote.sh, list-backups.sh and restore-remote.sh all called `aws`.
#   Neither nSelf box has it and neither can get it from apt: Ubuntu dropped the
#   awscli package in 24.04, so the whole backup path was unrunnable on the only
#   machines that need it (found 2026-08-24 while wiring the first scheduled
#   backup this project has ever had). rclone is a single static binary, is what
#   `nself backup stream` itself uses, and speaks S3 to R2 the same way.
#
#   So: use `aws` when it is there, otherwise `rclone`, and fail with an
#   actionable message when neither is. Sourced, not executed.
#
# Inputs:  BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, BACKUP_ACCESS_KEY,
#          BACKUP_SECRET_KEY (all required by the callers, not re-checked here).
# Outputs: s3_put_stream / s3_get_stream / s3_list / s3_delete, plus S3_CLIENT.
#
# CLI gap filed with nself: `nself backup stream` requires an age recipient and a
# preconfigured rclone remote, so it cannot yet replace these scripts without
# introducing key management this project has not decided on. See
# .claude/memory/decisions.md D-CR24-BACKUPS.

_rclone_flags() {
  printf '%s' "--s3-provider=Cloudflare --s3-access-key-id=${BACKUP_ACCESS_KEY} --s3-secret-access-key=${BACKUP_SECRET_KEY} --s3-endpoint=${BACKUP_S3_ENDPOINT} --s3-region=auto --s3-no-check-bucket"
}

if command -v aws >/dev/null 2>&1; then
  S3_CLIENT="aws"
elif command -v rclone >/dev/null 2>&1; then
  S3_CLIENT="rclone"
else
  echo "ERROR: neither 'aws' nor 'rclone' is installed. Install rclone:" >&2
  echo "  curl -fsSL https://rclone.org/install.sh | sudo bash" >&2
  exit 3
fi

export AWS_ACCESS_KEY_ID="${BACKUP_ACCESS_KEY:-}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_SECRET_KEY:-}"
export AWS_DEFAULT_REGION="auto"

# Read stdin, write it to <bucket>/<key>.
s3_put_stream() {
  local key="$1"
  if [ "$S3_CLIENT" = "aws" ]; then
    aws s3 cp - "s3://${BACKUP_S3_BUCKET}/${key}" \
      --endpoint-url "$BACKUP_S3_ENDPOINT" --no-progress
  else
    # shellcheck disable=SC2046  # flags must word-split
    rclone $(_rclone_flags) rcat ":s3:${BACKUP_S3_BUCKET}/${key}"
  fi
}

# Write <bucket>/<key> to stdout.
s3_get_stream() {
  local key="$1"
  if [ "$S3_CLIENT" = "aws" ]; then
    aws s3 cp "s3://${BACKUP_S3_BUCKET}/${key}" - \
      --endpoint-url "$BACKUP_S3_ENDPOINT" --no-progress
  else
    # shellcheck disable=SC2046
    rclone $(_rclone_flags) cat ":s3:${BACKUP_S3_BUCKET}/${key}"
  fi
}

# One line per object under <prefix>/: "<modified> <size> <key-basename>".
s3_list() {
  local prefix="$1"
  if [ "$S3_CLIENT" = "aws" ]; then
    aws s3 ls "s3://${BACKUP_S3_BUCKET}/${prefix}/" \
      --endpoint-url "$BACKUP_S3_ENDPOINT" \
      | awk '{print $1" "$2" "$3" "$4}'
  else
    # shellcheck disable=SC2046
    rclone $(_rclone_flags) lsjson ":s3:${BACKUP_S3_BUCKET}/${prefix}" 2>/dev/null \
      | python3 -c "
import json, sys
try:
    items = json.load(sys.stdin)
except Exception:
    items = []
for it in items:
    ts = str(it.get('ModTime', ''))[:19].replace('T', ' ')
    print(ts, it.get('Size', 0), it.get('Name', ''))
"
  fi
}

# Delete one object by full key.
s3_delete() {
  local key="$1"
  if [ "$S3_CLIENT" = "aws" ]; then
    aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --endpoint-url "$BACKUP_S3_ENDPOINT"
  else
    # shellcheck disable=SC2046
    rclone $(_rclone_flags) deletefile ":s3:${BACKUP_S3_BUCKET}/${key}"
  fi
}
