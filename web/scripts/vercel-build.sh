#!/usr/bin/env bash
# Vercel build step for the ɳTask web app. Runs from web/.
set -euo pipefail

# KNOWN LIMITATION — /api/og does not work on this deployment.
#
# api/og.ts is a Vercel Edge Function importing @nself-web/og, a workspace
# package in the sibling nself-org/packages checkout. Vercel's function bundler
# only traces files under the deployment root and will not follow a symlink out
# of it, so it fails with:
#
#   The Edge Function "api/og" is referencing unsupported modules:
#     - @nself-web/og
#
# Things that were tried and did not fix it:
#   - cloning, installing and building the shared packages (all needed for the
#     app build, and all now done in scripts/vercel-install.sh)
#   - copying the built package into web/node_modules — Vercel runs its own
#     install after installCommand and restores the symlink
#   - declaring @vercel/og in this app so the transitive dependency is local
#   - pre-bundling the function with esbuild, on both the browser and neutral
#     platforms. That removed the workspace import, but the function then
#     returned FUNCTION_INVOCATION_FAILED: bundling it ourselves stops Vercel
#     compiling @vercel/og's wasm the way the Edge runtime needs.
#
# The fix is to publish @nself-web/og to npm so the route can import it as an
# ordinary dependency and Vercel can compile it natively, exactly as it does
# today in the web monorepo. That is blocked on creating the @nself-web npm
# organisation. Six products consume this package, so vendoring it into this
# repo would duplicate code that was deliberately consolidated.
#
# Until then task.nself.org continues to serve from the web monorepo, where the
# package resolves normally.

exec pnpm build
