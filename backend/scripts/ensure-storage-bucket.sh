#!/usr/bin/env bash
# ensure-storage-bucket.sh — create the MinIO bucket attachments are stored in.
#
# Why this exists:
#   Nothing in the documented walkthrough creates it. `nself start` brings MinIO
#   up empty, so on a fresh self-host the whole attachment path fails at the last
#   step: getUploadUrl signs a perfectly valid URL and the upload answers
#   404 NoSuchBucket. Reproduced on a clean clone, 2026-08-24. The bucket has no
#   contents to seed and no schema to migrate, so nobody thinks to create it, and
#   the failure surfaces as "uploads are broken" rather than "run this command".
#
# Inputs:  MINIO_BUCKET, MINIO_ROOT_USER/MINIO_ACCESS_KEY,
#          MINIO_ROOT_PASSWORD/MINIO_SECRET_KEY, PROJECT_NAME (all from .env).
# Outputs: the bucket, created if absent. Idempotent and silent when it exists.
#
# Uses the official minio/mc image in a disposable container on the project
# network rather than adding a client to the host.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

env_value() {
  local key="$1" file line
  for file in .env .env.dev; do
    [ -f "$file" ] || continue
    line=$(grep -m1 -E "^[[:space:]]*${key}=" "$file" 2>/dev/null) || continue
    line="${line#*=}"; line="${line%\"}"; line="${line#\"}"
    printf '%s' "${line%%[[:space:]]#*}"
    return 0
  done
}

PROJECT="${PROJECT_NAME:-$(env_value PROJECT_NAME)}"; PROJECT="${PROJECT:-ntask}"
BUCKET="${MINIO_BUCKET:-$(env_value MINIO_BUCKET)}"; BUCKET="${BUCKET:-ntask}"
KEY="${MINIO_ACCESS_KEY:-$(env_value MINIO_ACCESS_KEY)}"
KEY="${KEY:-$(env_value MINIO_ROOT_USER)}"; KEY="${KEY:-minioadmin}"
SECRET="${MINIO_SECRET_KEY:-$(env_value MINIO_SECRET_KEY)}"
SECRET="${SECRET:-$(env_value MINIO_ROOT_PASSWORD)}"

if [ -z "$SECRET" ]; then
  echo "[storage-bucket] no MinIO secret in .env — skipping bucket check" >&2
  exit 0
fi
if ! docker ps --format '{{.Names}}' | grep -qx "${PROJECT}_minio"; then
  echo "[storage-bucket] ${PROJECT}_minio is not running — skipping bucket check" >&2
  exit 0
fi

docker run --rm --network "${PROJECT}_network" \
  -e MC_HOST_s="http://${KEY}:${SECRET}@minio:9000" \
  --entrypoint sh minio/mc:latest -c "
    if mc ls s/${BUCKET} >/dev/null 2>&1; then
      exit 0
    fi
    mc mb s/${BUCKET} && echo '[storage-bucket] created bucket ${BUCKET}'
  " 2>/dev/null || {
    echo "[storage-bucket] could not verify or create bucket '${BUCKET}'." >&2
    echo "[storage-bucket] Attachment uploads will fail with 404 NoSuchBucket until it exists." >&2
    exit 0
  }
