#!/usr/bin/env bash
# dr-drill.sh — restore the latest backup into a THROWAWAY Postgres container and
# verify it, measuring RTO. Non-destructive by construction.
#
# Why a container and not a scratch database on the live server:
#   a drill that needs `DROP DATABASE` before every run puts a destructive
#   statement on a monthly timer next to production data. A disposable container
#   has no such statement: it is created, restored into, inspected, and removed.
#   It also proves the dump restores into a CLEAN Postgres, which is the actual
#   disaster scenario — restoring into a database that already has the schema
#   proves much less.
#
# Inputs:  BACKUP_* from the project .env; PREFIX (default $BACKUP_S3_PREFIX);
#          PG_IMAGE (default postgres:16-alpine).
# Outputs: restored table counts and the measured RTO; non-zero exit if the
#          restore fails or the restored database has no rows in np_todos.
set -euo pipefail

NTASK_DIR="${NTASK_DIR:-/opt/nself-ntask}"
cd "$NTASK_DIR"
# shellcheck disable=SC1091
set -a; . ./.env; set +a

PREFIX="${PREFIX:-${BACKUP_S3_PREFIX:-ntask}}"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
NAME="ntask_dr_drill_$$"
NETWORK="${NETWORK:-ntask_network}"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

LATEST=$(BACKUP_S3_PREFIX="$PREFIX" bash scripts/list-backups.sh 2>/dev/null \
  | grep -Eo 'backup-[0-9-]+\.sql\.gz' | head -1)
[ -n "$LATEST" ] || { echo "[dr-drill] no backups found under $PREFIX" >&2; exit 1; }
echo "[dr-drill] restoring $PREFIX/$LATEST into a disposable $PG_IMAGE container"

START=$(date +%s)
docker run -d --name "$NAME" --network "$NETWORK" \
  -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=ntask_dr \
  "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$NAME" pg_isready -U postgres >/dev/null || {
  echo "[dr-drill] scratch Postgres never became ready" >&2; exit 1; }

# The dump carries its own CREATE SCHEMA statements. ON_ERROR_STOP is 0 because a
# plain pg_dump restored into a fresh cluster always reports a few benign
# failures (roles this cluster does not have, extensions already present); the
# row-count assertion at the end is what decides pass or fail.
# shellcheck source=scripts/s3-client.sh
source "$NTASK_DIR/scripts/s3-client.sh"
s3_get_stream "$PREFIX/$LATEST" | gunzip \
  | docker exec -i "$NAME" psql -U postgres -d ntask_dr -q -v ON_ERROR_STOP=0 >/dev/null

RTO=$(( $(date +%s) - START ))

echo "[dr-drill] restored tables:"
docker exec "$NAME" psql -U postgres -d ntask_dr -tAF'|' -c \
  "select table_name, (xpath('/row/c/text()', query_to_xml(
     format('select count(*) as c from %I.%I', table_schema, table_name),
     false, true, '')))[1]::text::int as rows
   from information_schema.tables
   where table_schema='public' and table_name like 'np_%'
   order by rows desc limit 10"

TODOS=$(docker exec "$NAME" psql -U postgres -d ntask_dr -tAc 'select count(*) from np_todos' 2>/dev/null || echo 0)
echo "[dr-drill] np_todos rows restored: $TODOS"
echo "[dr-drill] RTO: ${RTO}s"

[ "${TODOS:-0}" -gt 0 ] || { echo "[dr-drill] FAILED: restored database has no todos" >&2; exit 1; }
echo "[dr-drill] PASS"
