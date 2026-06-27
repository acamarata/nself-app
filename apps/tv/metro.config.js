/**
 * Purpose: Metro bundler config for react-native-tvos.
 * Constraints: Must alias 'react-native' → 'react-native-tvos' for workspace isolation.
 *   The pnpm override handles npm resolution; Metro needs the explicit alias so the
 *   bundler does not accidentally resolve standard react-native from a hoisted location.
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
    'react-native': require.resolve('react-native-tvos'),
  },
};

module.exports = config;
