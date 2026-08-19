#!/usr/bin/env bash
#
# deploy-staging.sh — build + deploy the ntask BFF to the staging box from the
# committed api/*.ts source (no hand snapshot). Idempotent + additive: it never
# recreates the drifted hasura/auth/postgres containers (uses --no-deps).
#
# Usage (from web/ntask):
#   ./bff/deploy-staging.sh            # sync source, build image, up --no-deps api
#
# Prereqs: SSH access to the staging box; docker + rsync on the box.
# The box already has /opt/nself-ntask/{docker-compose.staging-live.yml,api.env}.

set -euo pipefail

HOST="${NTASK_STAGING_HOST:-root@167.235.233.65}"
REMOTE_DIR="${NTASK_REMOTE_DIR:-/opt/nself-ntask}"
BUILD_DIR="${REMOTE_DIR}/api-bff"           # build context on the box (api/ + bff/)
IMAGE="${NTASK_BFF_IMAGE:-ntask-api:staging}"
COMPOSE="${REMOTE_DIR}/docker-compose.staging-live.yml"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # web/ntask
cd "$HERE"

echo ">> syncing committed source (api/ + bff/) to ${HOST}:${BUILD_DIR}"
ssh "$HOST" "mkdir -p '${BUILD_DIR}'"
rsync -az --delete --exclude 'dist' ./api/  "${HOST}:${BUILD_DIR}/api/"
rsync -az            ./bff/          "${HOST}:${BUILD_DIR}/bff/"

echo ">> building ${IMAGE} on the box from synced source"
ssh "$HOST" "cd '${BUILD_DIR}' && docker build -f bff/Dockerfile -t '${IMAGE}' ."

echo ">> bringing up the 'api' service (additive; --no-deps keeps other services untouched)"
ssh "$HOST" "docker compose -f '${COMPOSE}' up -d --no-deps api"

echo ">> health check"
ssh "$HOST" "docker run --rm --network ntask_network curlimages/curl:latest -s -o /dev/null -w 'BFF /api/auth/session -> %{http_code} (expect 401)\n' http://ntask_api:3080/api/auth/session"

echo ">> done. Remember to point nginx /api/ at ntask_api:3080 and reload."
