#!/bin/bash
# bootstrap.sh — Bootstrap ɳTasks development environment (nSelf-First)
#
# Per nSelf-First Doctrine (PPI § nSelf-First) and ntask PRI § Backend Approach
# (D6 superseded P98 02.T14, 2026-04-30), the backend is started via the nself
# CLI, not direct docker-compose.
set -e

echo "Bootstrapping ɳTasks development environment..."

# Navigate to repo root
cd "$(dirname "$0")/../.."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v nself >/dev/null 2>&1 || { echo "nself CLI required (install via: brew install nself-org/nself/nself)"; exit 1; }

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Seed env files BEFORE nself build (build reads .env to generate docker-compose.yml)
[ ! -f backend/.env ] && [ -f backend/.env.example ] && cp backend/.env.example backend/.env
[ ! -f frontend/.env.local ] && [ -f frontend/.env.local.example ] && cp frontend/.env.local.example frontend/.env.local

# Start backend via nSelf CLI (nSelf-First Doctrine: never `docker-compose up` directly)
echo "Building and starting backend via nself CLI..."
cd backend
nself build
nself start

echo "Waiting for services..."
sleep 10

echo "Bootstrap complete!"
echo ""
echo "Next steps:"
echo "  cd backend && nself status   # verify services"
echo "  cd backend && nself stop     # stop stack when done"
echo "  cd frontend && pnpm dev      # start frontend (or from root: pnpm dev)"
