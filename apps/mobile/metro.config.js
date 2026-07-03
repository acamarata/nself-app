/**
 * metro.config.js — Expo Metro config for ɳTask mobile.
 *
 * Purpose:    Default Expo config + a resolver shim for shared @nself/* TS
 *             packages that use ESM-style `./foo.js` relative imports (valid
 *             for tsc/vite/node, but Metro resolves literally and fails when
 *             only `foo.ts` exists). The shim retries such imports without
 *             the `.js` extension so Metro finds the `.ts` source.
 * Constraints: Scoped to imports originating inside @nself/ packages only —
 *             everything else uses Metro's default resolution untouched.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The @nself/* shared packages are pnpm workspace members that live OUTSIDE
// the ntask repo root (pnpm-workspace.yaml includes `../packages/@nself/*`).
// Expo's default watchFolders only cover the ntask workspace root, so Metro's
// file map misses those packages' own node_modules (e.g. react-i18next inside
// @nself/i18n). Watch them explicitly and let bare imports also resolve from
// the ntask root store.
const workspaceRoot = path.resolve(__dirname, '../..'); // .../nself/ntask
const sharedPackagesRoot = path.resolve(workspaceRoot, '../packages'); // .../nself/packages
// NOTE: do NOT add sibling repos' node_modules (e.g. ../nsentry/node_modules)
// to watchFolders — crawling a second .pnpm store breaks Metro startup.
// Bare deps used by the shared packages (react-i18next, i18next) are instead
// declared as direct dependencies of this app so the nodeModulesPaths
// fallback below resolves them from the app's own store.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  workspaceRoot,
  sharedPackagesRoot,
];
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.join(__dirname, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

// Node-only modules pulled in by @nself/observability's otel.ts. Its initOtel()
// already no-ops at runtime on native (appKind + isNodeRuntime guards), so the
// imports are dead code in this bundle — stub them with an empty module instead
// of dragging the Node OTel SDK (async_hooks, http, zlib, ...) into Metro.
const NODE_ONLY_STUBS = new Set([
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/exporter-zipkin',
  'async_hooks',
]);
const EMPTY_SHIM = path.join(__dirname, 'metro-empty-shim.js');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest
    ? (ctx, name, plat) => defaultResolveRequest(ctx, name, plat)
    : (ctx, name, plat) => ctx.resolveRequest(ctx, name, plat);
  if (NODE_ONLY_STUBS.has(moduleName)) {
    return { type: 'sourceFile', filePath: EMPTY_SHIM };
  }
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath.includes('/@nself/')
  ) {
    try {
      return resolve(context, moduleName.replace(/\.js$/, ''), platform);
    } catch (e) {
      // fall through to literal resolution
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
