/**
 * Purpose: Jest manual mock for expo-localization — returns a fixed English locale.
 * Used by: src/i18n/index.ts (imported transitively by any component using @nself/i18n)
 * Constraints: Expo native modules are not available in the jest-expo JS-only test environment.
 */
module.exports = {
  getLocales: jest.fn().mockReturnValue([{ languageTag: 'en', languageCode: 'en' }]),
  locale: 'en',
  locales: ['en'],
  timezone: 'UTC',
};
