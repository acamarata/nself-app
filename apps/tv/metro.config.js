/**
 * Purpose: Metro bundler config for react-native-tvos.
 * Constraints: Must alias 'react-native' → 'react-native-tvos' for workspace isolation.
 *   The root pnpm.overrides entry ("ntask-tv>react-native": "npm:react-native-tvos@...")
 *   makes pnpm install the tvos fork's contents INTO node_modules/react-native (npm-alias
 *   semantics — its package.json "name" field reads "react-native-tvos", but the directory
 *   itself is still named "react-native"). There is no separate node_modules/react-native-tvos
 *   directory, so Metro must resolve the 'react-native' specifier, not the literal string
 *   'react-native-tvos' (which would fail to resolve — see fix history in git log).
 *   react-native-tvos ships its own platform-specific files (*.ios.js, *.android.js)
 *   so no additional platform extension changes are needed.
 * SPORT: Epic F — TV scaffold.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Alias react-native → react-native-tvos for the Metro resolver.
// The pnpm package.json override handles npm install; this alias covers the runtime
// bundling pass so all RN imports resolve to the TV fork.
config.resolver = {
  ...config.resolver,
  resolverMainFields: ['react-native', 'browser', 'main'],
  extraNodeModules: {
    'react-native': require.resolve('react-native'),
  },
};

module.exports = config;
