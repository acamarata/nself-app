#!/usr/bin/env bash
# apply-compose-override.sh — make docker-compose.override.yml actually take effect.
#
# Why this exists (nSelf CLI gap, measured 2026-08-24):
#   `nself start` runs `docker compose -f <backend>/docker-compose.yml up -d` with
#   ONE -f. Compose only auto-merges docker-compose.override.yml when it is
#   invoked with no -f at all, so under `nself start` this repo's entire override
#   file is inert. Verified on a clean clone: the functions container came up
#   read-only, without the entrypoint that runs server.ts, without the SMTP,
#   MinIO, auth and webhook-secret variables, without mailhog, and with hasura
#   pointing at no ACTION_HANDLER_URL —
#     docker inspect ... com.docker.compose.project.config_files
#     -> .../docker-compose.yml        (the override is not listed)
#   Everything that override file documents as a fix was therefore fixed nowhere,
#   which is why production had to be hand-patched to work at all.
#
#   So after `nself start` has done its job (network, volumes, ordering, database
#   init), this re-applies the SAME compose project with BOTH files, which
#   reconciles the delta and leaves everything else untouched. It is idempotent:
#   with the override already applied, compose reports no changes.
#
# CLI gap filed with nself: nself-start-ignores-compose-override.
# Remove this script the day `nself start` merges the override itself.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

[ -f docker-compose.override.yml ] || exit 0
[ -f docker-compose.yml ] || { echo "[compose-override] no docker-compose.yml — run 'make build' first" >&2; exit 1; }

echo "[compose-override] applying docker-compose.override.yml (nself start does not merge it)"
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --remove-orphans
