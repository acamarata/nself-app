/**
 * react-native.config.js — RN CLI autolinking overrides for ɳTask mobile.
 *
 * Purpose: Under this pnpm monorepo layout, expo's own react-native.config.js
 * dependency override is not picked up, so RN CLI autolinking derives the
 * Expo package import from the Android gradle namespace ("expo.core") instead
 * of the real Kotlin package ("expo.modules"), producing a PackageList.java
 * that fails javac with "cannot find symbol: expo.core.ExpoModulesPackage".
 * This pins the correct import path explicitly.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
        },
      },
    },
  },
};
