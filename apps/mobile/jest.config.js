/**
 * Purpose: Jest configuration for jest-expo — pnpm-compatible transformIgnorePatterns.
 * Inputs:  jest-expo preset; @testing-library/jest-native matchers.
 * Outputs: Jest test runner configuration.
 * Constraints: Must use node_modules/.pnpm-aware transform pattern; no ts-node in CI.
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
      '|@apollo/client(?:/[^/]+)?' +
      ')' +
      ')',
  ],
};

module.exports = config;
