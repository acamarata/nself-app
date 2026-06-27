#!/usr/bin/env bash
# Verifies ntask version files are in sync.
# Source of truth: apps/mobile/package.json for the app version.
set -euo pipefail

ROOT_VER=$(node -p "require('./package.json').version")
MOBILE_VER=$(node -p "require('./apps/mobile/package.json').version")
WEB_VER=$(node -p "require('./web/ntask/package.json').version" 2>/dev/null || echo "N/A")

FAIL=0
if [ "$ROOT_VER" != "$MOBILE_VER" ]; then
  echo "::error::Version mismatch: root package.json=$ROOT_VER vs apps/mobile=$MOBILE_VER"
  FAIL=1
fi
echo "Root: $ROOT_VER | Mobile: $MOBILE_VER | Web/ntask: $WEB_VER"
if [ "$FAIL" -eq 1 ]; then exit 1; fi
echo "Version lockstep OK."
