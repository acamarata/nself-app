#!/bin/bash
# upgrade.sh — Upgrade ɳTasks to the latest version
#
# Sequence: backup -> stop -> pull -> nself build -> nself start -> migrate -> health
# Idempotent: running on an already-current stack is safe (migrations are no-ops if applied).
# Data safety: backup runs before any change; migrations are append-only in v1.x.

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

echo "==> ɳTasks upgrade starting..."
echo ""

# ---------------------------------------------------------------------------
# Current version
# ---------------------------------------------------------------------------
CURRENT_VERSION="unknown"
if command -v nself >/dev/null 2>&1; then
  CURRENT_VERSION=$(nself version 2>/dev/null || echo "unknown")
fi
echo "    Current nself CLI version: $CURRENT_VERSION"
if [ -f "$REPO_ROOT/apps/mobile/package.json" ]; then
  APP_VERSION=$(node -e "console.log(require('$REPO_ROOT/apps/mobile/package.json').version)" 2>/dev/null || echo "unknown")
  echo "    Current app version:       $APP_VERSION"
fi
echo ""

# ---------------------------------------------------------------------------
# Backup (always runs — even if git pull is skipped)
# ---------------------------------------------------------------------------
echo "==> Step 1/6: Creating database backup..."
cd "$BACKEND_DIR"
make backup
echo "[ok] Backup created in backend/backups/"

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------
echo "==> Step 2/6: Stopping backend stack..."
nself stop || true
echo "[ok] Stack stopped"

# ---------------------------------------------------------------------------
# Pull (non-destructive; skip gracefully if not a git repo or has local changes)
# ---------------------------------------------------------------------------
echo "==> Step 3/6: Pulling latest code..."
cd "$REPO_ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git diff --quiet && git diff --cached --quiet; then
    git pull --ff-only 2>&1 || {
      echo "WARNING: git pull --ff-only failed (diverged history or network error)."
      echo "         Continuing upgrade with current checkout."
    }
  else
    echo "WARNING: Local changes detected — skipping git pull to avoid conflicts."
    echo "         Commit or stash local changes, then re-run make upgrade."
  fi
else
  echo "[skip] Not a git repo — skipping pull (manual update required)"
fi

# ---------------------------------------------------------------------------
# Rebuild
# ---------------------------------------------------------------------------
echo "==> Step 4/6: Rebuilding backend stack (nself build)..."
cd "$BACKEND_DIR"
nself build
echo "[ok] Build complete"

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
echo "==> Step 5/6: Starting backend stack (nself start)..."
nself start

# Wait for Hasura to be healthy before running migrations
TRIES=0
MAX_TRIES=20
until curl -sf http://localhost:8080/healthz >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "ERROR: Hasura did not become healthy after $((MAX_TRIES * 3))s."
    echo "  Check logs: make logs-hasura"
    exit 1
  fi
  sleep 3
done
echo "[ok] Stack is healthy"

# ---------------------------------------------------------------------------
# Migrate
# ---------------------------------------------------------------------------
echo "==> Step 6/6: Applying migrations and metadata..."
if command -v hasura >/dev/null 2>&1 && [ -d "$BACKEND_DIR/hasura" ]; then
  cd "$BACKEND_DIR"
  make migrate
  echo "[ok] Migrations applied"
else
  echo "[skip] hasura CLI not found or hasura/ dir absent — skipping migrations"
  echo "       Install hasura CLI to run migrations: https://hasura.io/docs/latest/hasura-cli/install-hasura-cli/"
fi

# ---------------------------------------------------------------------------
# Final health check
# ---------------------------------------------------------------------------
echo ""
cd "$BACKEND_DIR"
make health

echo ""
echo "Upgrade complete!"
if [ -f "$REPO_ROOT/apps/mobile/package.json" ]; then
  NEW_VERSION=$(node -e "console.log(require('$REPO_ROOT/apps/mobile/package.json').version)" 2>/dev/null || echo "unknown")
  echo "  App version: $NEW_VERSION"
fi
echo ""
echo "Next steps:"
echo "  Restart the Expo dev server to pick up any JS bundle changes."
echo "  EAS Build if native module changes are included (check UPGRADE.md)."
