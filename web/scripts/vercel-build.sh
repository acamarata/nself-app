#!/usr/bin/env bash
# Vercel build step for the ɳTask web app. Runs from web/.
#
# Exists because Vercel runs its OWN dependency install after installCommand,
# which recreates web/node_modules. Anything materialised there during install
# is replaced by a symlink again, so this has to happen at build time.
set -euo pipefail

PACKAGES_DIR="$(cd ../.. && pwd)/packages"

# Vercel's function bundler only traces files under the deployment root and will
# not follow a symlink out to the sibling packages checkout. api/og.ts is an
# Edge Function importing @nself-web/og, so that package must exist as real
# files inside web/node_modules:
#
#   The Edge Function "api/og" is referencing unsupported modules:
#     - @nself-web/og
#
# It is the only workspace package anything under api/ imports. The app's own
# imports are unaffected — vite inlines them from source.
OG_SRC="$PACKAGES_DIR/@nself-web/og"
OG_DEST="./node_modules/@nself-web/og"
if [[ ! -d "$OG_SRC/dist" ]]; then
  echo "ERROR: $OG_SRC/dist missing — the shared packages build produced no output" >&2
  exit 1
fi
echo "Materialising @nself-web/og into web/node_modules"
rm -rf "$OG_DEST"
mkdir -p "$(dirname "$OG_DEST")"
cp -RL "$OG_SRC" "$OG_DEST"
rm -rf "$OG_DEST/node_modules" "$OG_DEST/src" "$OG_DEST/__tests__"

exec pnpm build
