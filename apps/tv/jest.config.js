/**
 * Jest config for ɳTask TV.
 *
 * QUIRK — react-native-tvos + pnpm virtual store + jest-expo:
 *   jest-expo's preset setup.js loads react-native-tvos/jest/setup.js which in turn
 *   requires @react-native/js-polyfills. In pnpm's virtual store the package path uses
 *   '+' instead of '/' (e.g. @react-native+js-polyfills@0.79.2), so the standard
 *   transformIgnorePatterns pattern "@react-native/js-polyfills" does NOT match and
 *   Flow-typed source is not transformed, causing a parse error.
 *
 *   Resolution: use testEnvironment 'node' + a custom transform setup that bypasses
 *   react-native's Babel preset for pure-logic test suites. Component/screen tests
 *   that need the RN environment should use jest-expo/src/preset directly with a
 *   custom setup file once EAS provisioning is complete.
 *
 *   This is a known issue with react-native-tvos in pnpm workspaces; tracked in SPIKE.md.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.test.{ts,tsx}',
  ],
  // For pure-logic tests (no React/RN imports), transformIgnorePatterns can be minimal.
  // Tests that import RN components will need to be moved to an rn/ subdirectory
  // with a separate jest config once the pnpm+tvos transform issue is resolved.
  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
