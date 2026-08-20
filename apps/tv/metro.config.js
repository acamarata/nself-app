/**
 * Purpose: Metro bundler config for react-native-tvos.
 * Constraints:
 *   1. Must alias 'react-native' → 'react-native-tvos' for workspace isolation.
 *      The root pnpm.overrides entry ("ntask-tv>react-native": "npm:react-native-tvos@...")
 *      makes pnpm install the tvos fork's contents INTO node_modules/react-native (npm-alias
 *      semantics — its package.json "name" field reads "react-native-tvos", but the directory
 *      itself is still named "react-native"). There is no separate node_modules/react-native-tvos
 *      directory, so Metro must resolve the 'react-native' specifier, not the literal string
 *      'react-native-tvos' (which would fail to resolve — see fix history in git log).
 *      react-native-tvos ships its own platform-specific files (*.ios.js, *.android.js)
 *      so no additional platform extension changes are needed.
 *   2. The shared @nself/* workspace packages live at <repo>/packages
 *      and author their internal imports with ESM-style `./foo.js` specifiers (valid for
 *      tsc/vite/node, but Metro resolves them literally and fails when only `foo.ts` exists —
 *      e.g. @nself/graphql-client's `export { ... } from './client.js'`). Watch those folders
 *      and retry any `./x.js` import originating inside an @nself/ package as `./x` so Metro
 *      finds the `.ts` source. Mirrors the proven shim in apps/mobile/metro.config.js.
 * SPORT: Epic F — TV scaffold.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// --- Shared @nself/* workspace packages (live outside this app) ---
const workspaceRoot = path.resolve(__dirname, '../..'); // .../nself/ntask
const sharedPackagesRoot = path.resolve(workspaceRoot, 'packages'); // <repo>/packages (cloned in)
config.watchFolders = [
  ...(config.watchFolders ?? []),
  workspaceRoot,
  sharedPackagesRoot,
];

// --- react-native → react-native-tvos alias (constraint 1) ---
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'react-native': require.resolve('react-native'),
};
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.join(__dirname, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

// --- `./x.js` → `./x` retry for imports originating inside @nself/ packages (constraint 2) ---
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest
    ? (ctx, name, plat) => defaultResolveRequest(ctx, name, plat)
    : (ctx, name, plat) => ctx.resolveRequest(ctx, name, plat);
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
