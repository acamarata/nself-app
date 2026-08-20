#!/usr/bin/env bash
# Vercel install step for the ɳTask web app.
#
# Runs from web/ (the project's rootDirectory). Vercel checks out one
# repository, but pnpm-workspace.yaml resolves ../packages/@nself/* and
# ../packages/@nself-web/* from a sibling checkout, so this has to fetch and
# prepare that itself.
#
# vercel.json's installCommand is capped at 256 characters, which is why this
# lives in a script rather than inline.
set -euo pipefail

REPO_ROOT="$(cd .. && pwd)"
PACKAGES_DIR="$(cd ../.. && pwd)/packages"

# 1. Shared packages. Public since 2026-08-20, so no credential is involved.
if [[ ! -d "$PACKAGES_DIR/.git" ]]; then
  echo "Cloning nself-org/packages -> $PACKAGES_DIR"
  git clone --depth 1 https://github.com/nself-org/packages.git "$PACKAGES_DIR"
else
  echo "Shared packages already present"
fi

# pnpm hardlinks from its store, which lands on a different device than
# node_modules on Vercel's builders (ERR_PNPM_EXDEV). Copy instead.
PNPM_FLAGS=(--no-frozen-lockfile --config.package-import-method=copy)

# 2. This workspace.
echo "Installing app workspace"
(cd "$REPO_ROOT" && pnpm install "${PNPM_FLAGS[@]}")

# 3. The shared packages' own dependencies. That checkout is a sibling rather
#    than an ancestor, so it cannot reach this workspace's hoisted modules, and
#    Rollup follows the aliased source files' imports (i18next, react).
echo "Installing shared packages dependencies"
(cd "$PACKAGES_DIR" && pnpm install "${PNPM_FLAGS[@]}")

# 4. Build them. vite resolves the packages through source aliases, but Vercel
#    compiles api/ separately as functions using plain node resolution, which
#    needs a real dist and the package.json exports.
echo "Building shared packages"
(cd "$PACKAGES_DIR" && pnpm -r build)

# 5. Vercel's function bundler only traces files under the deployment root, and
#    it will not follow a symlink out to /vercel/packages. api/og.ts is an Edge
#    Function importing @nself-web/og, so that one package has to exist as real
#    files inside web/node_modules:
#
#      The Edge Function "api/og" is referencing unsupported modules:
#        - @nself-web/og
#
#    Only this package needs it; nothing else under api/ imports a workspace
#    package. The app's own imports are unaffected — vite inlines them from
#    source at build time.
OG_SRC="$PACKAGES_DIR/@nself-web/og"
OG_DEST="./node_modules/@nself-web/og"
if [[ -d "$OG_SRC/dist" ]]; then
  echo "Materialising @nself-web/og into web/node_modules"
  rm -rf "$OG_DEST"
  mkdir -p "$(dirname "$OG_DEST")"
  cp -RL "$OG_SRC" "$OG_DEST"
  rm -rf "$OG_DEST/node_modules" "$OG_DEST/src" "$OG_DEST/__tests__"
else
  echo "WARNING: $OG_SRC/dist missing — the og build did not produce output" >&2
  exit 1
fi
