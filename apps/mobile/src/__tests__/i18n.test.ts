/**
 * Purpose: i18n key completeness test — ensures fr + es have all keys present in en baseline.
 * Constraints: New locales must not miss any en key. Flat key comparison per namespace.
 * SPORT: C-S2-T3
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const enCommon = require('../i18n/en/common.json') as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const enNav = require('../i18n/en/nav.json') as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const enScreens = require('../i18n/en/screens.json') as Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const frCommon = require('../i18n/fr/common.json') as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const frNav = require('../i18n/fr/nav.json') as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const frScreens = require('../i18n/fr/screens.json') as Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const esCommon = require('../i18n/es/common.json') as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const esNav = require('../i18n/es/nav.json') as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const esScreens = require('../i18n/es/screens.json') as Record<string, unknown>;

/** Recursively extract all dot-notation keys from a nested JSON object. */
function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return flatKeys(v as Record<string, unknown>, full);
    }
    return [full];
  });
}

function missingKeys(base: Record<string, unknown>, target: Record<string, unknown>): string[] {
  const baseKeys = new Set(flatKeys(base));
  const targetKeys = new Set(flatKeys(target));
  return [...baseKeys].filter((k) => !targetKeys.has(k));
}

describe('i18n key completeness', () => {
  describe('French (fr)', () => {
    it('fr/common.json has all en keys', () => {
      expect(missingKeys(enCommon, frCommon)).toEqual([]);
    });
    it('fr/nav.json has all en keys', () => {
      expect(missingKeys(enNav, frNav)).toEqual([]);
    });
    it('fr/screens.json has all en keys', () => {
      expect(missingKeys(enScreens, frScreens)).toEqual([]);
    });
  });

  describe('Spanish (es)', () => {
    it('es/common.json has all en keys', () => {
      expect(missingKeys(enCommon, esCommon)).toEqual([]);
    });
    it('es/nav.json has all en keys', () => {
      expect(missingKeys(enNav, esNav)).toEqual([]);
    });
    it('es/screens.json has all en keys', () => {
      expect(missingKeys(enScreens, esScreens)).toEqual([]);
    });
  });
});
