#!/usr/bin/env bash
# Vercel build step for the ɳTask web app. Runs from web/.
set -euo pipefail

PACKAGES_DIR="$(cd ../.. && pwd)/packages"

# api/og.ts imports @nself-web/og, a workspace package living in the sibling
# packages checkout. Vercel's Edge Function bundler only traces files under the
# deployment root and will not follow a symlink out of it, so it fails with:
#
#   The Edge Function "api/og" is referencing unsupported modules:
#     - @nself-web/og
#
# Copying the package into web/node_modules does not help: Vercel runs its own
# install after installCommand and restores the symlink.
#
# So bundle the function ourselves. esbuild follows the symlink at build time
# and inlines the package, leaving a single file with no workspace imports for
# Vercel to resolve. @vercel/og stays external — it is a real dependency of this
# app and ships wasm that must not be inlined.
if [[ -f api/og.ts ]]; then
  echo "Pre-bundling api/og.ts (inlining @nself-web/og)"
  # Overwrite api/og.ts in place rather than emitting a .js and deleting the
  # .ts: Vercel enumerates api/ before this script runs, so removing the file it
  # already catalogued fails the deploy with "File not found: .../api/og.ts".
  pnpm exec esbuild api/og.ts \
    --bundle \
    --format=esm \
    --platform=neutral \
    --main-fields=module,main \
    --conditions=edge-light,worker,browser,import \
    --target=es2022 \
    --external:@vercel/og \
    --outfile=api/og.bundled.mjs
  mv api/og.bundled.mjs api/og.ts
  echo "  -> api/og.ts rewritten self-contained ($(wc -c < api/og.ts) bytes)"
fi

exec pnpm build
