/**
 * Purpose: Jest configuration for jest-expo — pnpm-compatible transformIgnorePatterns.
 * Inputs:  jest-expo preset; @testing-library/jest-native matchers.
 * Outputs: Jest test runner configuration.
 * Constraints: Must use node_modules/.pnpm-aware transform pattern; no ts-node in CI.
 *   Updated for SDK 53: @apollo/client removed; urql + @nself/* added to transform list.
 * SPORT: T-E1-05
 */
/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  // pnpm stores packages under node_modules/.pnpm/<name>@<ver>/node_modules/<name>/.
  // The standard jest-expo pattern only matches node_modules/<name>/ and misses the
  // inner node_modules/ segment for pnpm packages. This pattern handles both layouts.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?' +
      '(?:' +
      '(?:jest-)?react-native' +
      '|@react-native(?:-community)?(?:/[^/]+)?' +
      '|expo(?:nent)?(?:/[^/]+)?' +
      '|@expo(?:nent)?(?:/[^/]+)?' +
      '|@expo-google-fonts(?:/[^/]+)?' +
      '|react-navigation(?:/[^/]+)?' +
      '|@react-navigation(?:/[^/]+)?' +
      '|@unimodules(?:/[^/]+)?' +
      '|unimodules' +
      '|sentry-expo' +
      '|native-base' +
      '|react-native-svg' +
      '|urql(?:/[^/]+)?' +
      '|@urql(?:/[^/]+)?' +
      '|wonka' +
      '|@nself(?:/[^/]+)?' +
      ')' +
      ')',
  ],
  moduleNameMapper: {
    // Map @nself/* workspace packages to their src entry points for Jest
    '^@nself/graphql-client(.*)$': '<rootDir>/../../../packages/@nself/graphql-client/src/index.ts',
    '^@nself/auth-core(.*)$': '<rootDir>/../../../packages/@nself/auth-core/src/index.ts',
    '^@nself/i18n(.*)$': '<rootDir>/../../../packages/@nself/i18n/src/index.ts',
    '^@nself/observability(.*)$': '<rootDir>/../../../packages/@nself/observability/src/index.ts',
    '^@nself/errors(.*)$': '<rootDir>/../../../packages/@nself/errors/src/index.ts',
    '^@nself/sdk-core(.*)$': '<rootDir>/../../../packages/@nself/sdk-core/src/index.ts',
    '^@nself/types(.*)$': '<rootDir>/../../../packages/@nself/types/src/index.ts',
    // Native modules not available in Jest (no native build) — provide manual mocks
    '^react-native-mmkv$': '<rootDir>/__mocks__/react-native-mmkv.js',
    '^@shopify/flash-list$': '<rootDir>/__mocks__/@shopify/flash-list.js',
    '^@react-native-community/netinfo$': '<rootDir>/__mocks__/@react-native-community/netinfo.js',
    '^expo-localization$': '<rootDir>/__mocks__/expo-localization.js',
  },
};

module.exports = config;
