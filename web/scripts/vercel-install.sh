#!/usr/bin/env bash
# Vercel install step for the ɳTask web app.
#
# Runs from web/ (the project's rootDirectory). Vercel checks out one
# repository and uploads only that, so the shared packages are cloned INSIDE
# the repo at packages/ (gitignored) rather than beside it. Anything above the
# repository root is invisible to Vercel's function bundler, which is why
# /api/og could not resolve @nself-web/og while they lived in a sibling.
#
# vercel.json's installCommand is capped at 256 characters, which is why this
# lives in a script rather than inline.
set -euo pipefail

REPO_ROOT="$(cd .. && pwd)"
PACKAGES_DIR="$REPO_ROOT/packages"

# 1. Shared packages. Public since 2026-08-20, so no credential is involved.
#
# Vercel restores a build cache that can contain packages/ WITHOUT its .git
# directory. A plain "-d .git" guard then decides to clone and git aborts with
#   fatal: destination path '/vercel/path0/packages' already exists
#         and is not an empty directory
# which fails the whole build. Treat "present but not a checkout" as stale and
# replace it, so a cached layer can never wedge the install.
if [[ -d "$PACKAGES_DIR/.git" ]]; then
  echo "Shared packages already present (git checkout)"
elif [[ -e "$PACKAGES_DIR" ]]; then
  echo "Stale packages/ from build cache and not a git checkout — replacing"
  rm -rf "$PACKAGES_DIR"
  git clone --depth 1 https://github.com/nself-org/packages.git "$PACKAGES_DIR"
else
  echo "Cloning nself-org/packages -> $PACKAGES_DIR"
  git clone --depth 1 https://github.com/nself-org/packages.git "$PACKAGES_DIR"
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
