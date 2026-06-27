/**
 * Purpose: Unit tests for src/i18n/index.ts — locale detection, RTL initialization,
 *   and Hijri date formatting.
 * Inputs: Mocked expo-localization, @nself/i18n, react-native I18nManager
 * Outputs: Asserts detectLocale mapping, forceRTL call behavior, formatHijriDate output
 * Constraints: Does not test i18n key completeness (i18n.test.ts covers that).
 *   jest.mock factories are hoisted before const declarations — use jest.fn() inline
 *   and retrieve references via jest.requireMock() after import.
 * SPORT: C-S2-T3 (i18n/RTL)
 */

// ── Mocks must appear before imports ──────────────────────────────────────────
// NOTE: jest.mock() factories are hoisted ahead of all variable declarations.
// References to outer consts (mockGetLocales etc.) inside factories would be
// undefined. Use jest.fn() inline and pull references via jest.requireMock().

jest.mock('expo-localization', () => ({
  getLocales: jest.fn().mockReturnValue([{ languageCode: 'en' }]),
}));

jest.mock('@nself/i18n', () => ({
  initializeI18next: jest.fn(),
}));

// Minimal RN mock: only I18nManager needed; spreading requireActual triggers
// native TurboModuleRegistry.getEnforcing() which fails in jsdom.
jest.mock('react-native', () => ({
  I18nManager: {
    isRTL: false,
    forceRTL: jest.fn(),
  },
}));

import { detectLocale, getDeviceLocale, initializeI18n, formatHijriDate } from '../i18n/index';

// Convenience getters — pull from the module registry after import
function getLocalesMock(): jest.Mock {
  return (jest.requireMock('expo-localization') as { getLocales: jest.Mock }).getLocales;
}
function initI18nextMock(): jest.Mock {
  return (jest.requireMock('@nself/i18n') as { initializeI18next: jest.Mock }).initializeI18next;
}
function getI18nManager(): { isRTL: boolean; forceRTL: jest.Mock } {
  return (jest.requireMock('react-native') as { I18nManager: { isRTL: boolean; forceRTL: jest.Mock } }).I18nManager;
}

beforeEach(() => {
  jest.clearAllMocks();
  getLocalesMock().mockReturnValue([{ languageCode: 'en' }]);
  getI18nManager().isRTL = false;
});

// ─── detectLocale ─────────────────────────────────────────────────────────────

describe('detectLocale', () => {
  it('returns en for English locale', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'en' }]);
    expect(detectLocale()).toBe('en');
  });

  it('returns ar for Arabic locale', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'ar' }]);
    expect(detectLocale()).toBe('ar');
  });

  it('falls back to en for unsupported locale (zh)', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'zh' }]);
    expect(detectLocale()).toBe('en');
  });

  it('falls back to en when getLocales returns empty array', () => {
    getLocalesMock().mockReturnValue([]);
    expect(detectLocale()).toBe('en');
  });

  it('strips region suffix from BCP-47 tags (en-US -> en)', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'en-US' }]);
    expect(detectLocale()).toBe('en');
  });

  it('strips region suffix from BCP-47 tags (ar-SA -> ar)', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'ar-SA' }]);
    expect(detectLocale()).toBe('ar');
  });
});

// ─── getDeviceLocale ──────────────────────────────────────────────────────────

describe('getDeviceLocale', () => {
  it('returns a string', () => {
    expect(typeof getDeviceLocale()).toBe('string');
  });

  it('returns en when device locale is English', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'en' }]);
    expect(getDeviceLocale()).toBe('en');
  });

  it('returns ar when device locale is Arabic', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'ar' }]);
    expect(getDeviceLocale()).toBe('ar');
  });
});

// ─── initializeI18n ───────────────────────────────────────────────────────────

describe('initializeI18n', () => {
  it('calls forceRTL(true) when overrideLocale is ar and isRTL is false', () => {
    getI18nManager().isRTL = false;
    initializeI18n('ar');
    expect(getI18nManager().forceRTL).toHaveBeenCalledWith(true);
  });

  it('does NOT call forceRTL when en and isRTL is already false', () => {
    getI18nManager().isRTL = false;
    initializeI18n('en');
    expect(getI18nManager().forceRTL).not.toHaveBeenCalled();
  });

  it('falls back to en and does not call forceRTL for unknown overrideLocale', () => {
    getI18nManager().isRTL = false;
    initializeI18n('xx-unknown');
    expect(getI18nManager().forceRTL).not.toHaveBeenCalled();
  });

  it('calls initializeI18next with the resolved locale', () => {
    initializeI18n('ar');
    expect(initI18nextMock()).toHaveBeenCalledWith('ar');
  });

  it('calls initializeI18next with en for unknown locale', () => {
    initializeI18n('zz');
    expect(initI18nextMock()).toHaveBeenCalledWith('en');
  });

  it('calls initializeI18next using detected locale when no override supplied', () => {
    getLocalesMock().mockReturnValue([{ languageCode: 'en' }]);
    initializeI18n();
    expect(initI18nextMock()).toHaveBeenCalledWith('en');
  });

  it('calls forceRTL(false) when switching from RTL to LTR', () => {
    getI18nManager().isRTL = true;
    initializeI18n('en');
    expect(getI18nManager().forceRTL).toHaveBeenCalledWith(false);
  });
});

// ─── formatHijriDate ─────────────────────────────────────────────────────────

describe('formatHijriDate', () => {
  it('returns a non-empty string for a valid Date object', () => {
    const result = formatHijriDate(new Date('2026-06-16'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for a valid ISO date string', () => {
    const result = formatHijriDate('2026-06-16');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the original string for an invalid date string', () => {
    const result = formatHijriDate('not-a-date');
    expect(result).toBe('not-a-date');
  });

  it('accepts an optional locale parameter without throwing', () => {
    expect(() => formatHijriDate(new Date('2026-06-16'), 'en')).not.toThrow();
    expect(() => formatHijriDate(new Date('2026-06-16'), 'ar')).not.toThrow();
  });

  it('defaults to ar locale (returns string with Arabic or ISO fallback)', () => {
    const result = formatHijriDate(new Date('2026-01-01'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('parses an ISO date string and formats it', () => {
    const result = formatHijriDate('2026-06-16', 'en');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
