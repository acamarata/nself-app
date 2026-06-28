#!/bin/bash
# bootstrap.sh — Bootstrap ɳTasks development environment (nSelf-First)
#
# Idempotent: safe to re-run on an already-bootstrapped clone.
# Does NOT auto-generate secrets — copies .env.example as-is.
# Change secrets in backend/.env.dev before production use.
#
# Per nSelf-First Doctrine: backend starts via `nself start`, never raw docker compose.

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

echo "==> Bootstrapping ɳTasks development environment..."
echo ""

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: $1 is required but not found."; echo "  $2"; exit 1; }
}

check_cmd docker   "Install Docker: https://www.docker.com/products/docker-desktop/"
check_cmd nself    "Install nSelf CLI: brew install nself-org/tap/nself  (or see nself.org/install)"
check_cmd node     "Install Node.js 20+: https://nodejs.org/"
check_cmd pnpm     "Install pnpm: npm install -g pnpm"

echo "[ok] Prerequisites found"

# ---------------------------------------------------------------------------
# Backend env file
# ---------------------------------------------------------------------------
ENV_FILE="$BACKEND_DIR/.env.dev"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

if [ -f "$ENV_FILE" ]; then
  echo "[ok] backend/.env.dev already exists — skipping (delete manually to reset)"
else
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "[created] backend/.env.dev — review secrets before production use"
  echo "          (HINT: openssl rand -hex 64  for AUTH_JWT_SECRET)"
fi

# ---------------------------------------------------------------------------
# Mobile env file
# ---------------------------------------------------------------------------
MOBILE_ENV="$REPO_ROOT/apps/mobile/.env.local"
MOBILE_EXAMPLE="$REPO_ROOT/apps/mobile/.env.example"

if [ -f "$MOBILE_ENV" ]; then
  echo "[ok] apps/mobile/.env.local already exists — skipping"
elif [ -f "$MOBILE_EXAMPLE" ]; then
  cp "$MOBILE_EXAMPLE" "$MOBILE_ENV"
  echo "[created] apps/mobile/.env.local"
fi

# ---------------------------------------------------------------------------
# Backend: build + start via nSelf CLI
# ---------------------------------------------------------------------------
echo ""
echo "==> Building backend stack (nself build)..."
cd "$BACKEND_DIR"
nself build

echo "==> Starting backend stack (nself start)..."
nself start

# ---------------------------------------------------------------------------
# Health check (poll up to 60s)
# ---------------------------------------------------------------------------
echo "==> Waiting for services to become healthy..."
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

echo "[ok] Hasura is healthy"

# ---------------------------------------------------------------------------
# Apply PostgreSQL schema + migrations
# ---------------------------------------------------------------------------
echo ""
echo "==> Applying database schema and migrations..."
bash "$BACKEND_DIR/scripts/db-migrate.sh"
echo "[ok] Database migrations complete"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Bootstrap complete!"
echo ""
echo "  Backend (Hasura GraphQL): http://localhost:8080"
echo "  Hasura Console:           http://localhost:8080/console"
echo "  Auth service:             http://localhost:4000"
echo "  Storage service:          http://localhost:8484"
echo "  Mailhog (dev email UI):   http://localhost:8025"
echo ""
echo "Next steps:"
echo "  cd apps/mobile && pnpm install && pnpm start   # start Expo dev server"
echo "  DEMO_SEED=1 make demo-seed                      # load example tasks (optional)"
echo "  make health                                      # re-verify backend health"
echo "  make down                                        # stop backend when done"
