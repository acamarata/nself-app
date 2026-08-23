/**
 * i18n Configuration — ɳTask mobile (React Native + Expo)
 *
 * Purpose: Initialize i18next with locale detection and RTL support.
 *   Exports initializeI18n() for call at app root before any render.
 *   Exports formatHijriDate() for Hijri date display in event/prayer date slots.
 *
 * Inputs: none (reads device locale via I18nManager.getConstants())
 * Outputs: Initialized i18next instance; I18nManager.forceRTL set for Arabic
 * Constraints:
 *   - Must be called before rendering app root.
 *   - Hijri formatting uses Intl.DateTimeFormat with calendar:'islamic-umalqura',
 *     which is supported in Hermes (Expo SDK 53+). Falls back to ISO string if
 *     the calendar extension is unavailable in CI/test environments.
 *
 * SPORT: F12-REPO-TYPE-MAP.md (ntask row — RTL complete)
 */

import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { initializeI18next } from '@nself/i18n';
import { registerMobileResources } from './resources';

// ─── Supported locales ────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['en', 'ar'] as const;
const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur']);

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// ─── Detect device locale ─────────────────────────────────────────────────────

/**
 * Detect the device locale via expo-localization.
 * expo-localization.getLocales() returns BCP-47 language tags (e.g. 'ar', 'en-US').
 * Falls back to 'en' if detection fails or locale is unsupported.
 */
function detectLocale(): SupportedLocale {
  const locales = Localization.getLocales();
  const raw = locales[0]?.languageCode ?? 'en';
  const lang = raw.split(/[-_]/)[0]!.toLowerCase();
  return (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(lang)
    ? (lang as SupportedLocale)
    : 'en';
}

/**
 * Get device locale string via expo-localization (exported for app root use).
 */
export function getDeviceLocale(): string {
  return detectLocale();
}

// ─── Initialize i18n ──────────────────────────────────────────────────────────

/**
 * Initialize the i18next copy the app itself imports (hoisted root node_modules),
 * not just the one inside the vendored @nself/i18n package.
 *
 * Why both: this repo installs with node-linker=hoisted, and the vendored
 * packages/@nself/i18n keeps nested symlinked dependencies — so @nself/i18n's
 * initializeI18next configures a different i18next instance than the one app
 * components reach via import 'i18next' / 'react-i18next'. Screens call
 * useTranslation() on the app copy, so that copy must be initialized too.
 */
function ensureAppInstance(locale: string): void {
  if (!i18next.isInitialized) {
    i18next.use(initReactI18next).init({
      lng: locale,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  } else {
    void i18next.changeLanguage(locale);
  }
}

/**
 * Initialize i18n for ɳTask mobile.
 * - Detects device locale via I18nManager constants
 * - Enables RTL layout for Arabic/Hebrew/Farsi/Urdu via I18nManager.forceRTL
 * - Initializes i18next via @nself/i18n (package base catalog) and for the app
 *   tree, then attaches this app's namespace bundles so t('nav:…') resolves.
 *
 * Must be called before rendering app root.
 * @param overrideLocale — optional override for testing or settings-driven locale
 */
export function initializeI18n(overrideLocale?: string): void {
  const locale = overrideLocale
    ? ((SUPPORTED_LOCALES as ReadonlyArray<string>).includes(overrideLocale)
        ? overrideLocale
        : 'en')
    : detectLocale();

  const isRtl = RTL_LOCALES.has(locale);

  // I18nManager.forceRTL flips the entire layout coordinate system for RTL locales.
  // A reload is handled by the caller if needed (Expo Updates.reloadAsync()).
  if (I18nManager.isRTL !== isRtl) {
    I18nManager.forceRTL(isRtl);
  }

  initializeI18next(locale as 'en');
  ensureAppInstance(locale);
  registerMobileResources(i18next);
}

// ─── Hijri date formatting ────────────────────────────────────────────────────

/**
 * Format a date using the Hijri (Islamic Umm al-Qura) calendar.
 * Used for event dates and prayer times in ɳTask mobile.
 *
 * @param date — Date object or ISO string
 * @param locale — Display locale; defaults to 'ar-SA' for Arabic output
 * @returns Formatted Hijri date string; falls back to ISO YYYY-MM-DD on error
 *
 * @example
 * formatHijriDate(new Date('2026-06-16'), 'ar') // '١٩ ذو الحجة ١٤٤٧'
 * formatHijriDate(new Date('2026-06-16'), 'en') // '19 Dhū al-Ḥijja 1447'
 */
export function formatHijriDate(date: Date | string, locale = 'ar'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);

  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : locale, {
      calendar: 'islamic-umalqura',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    } as Intl.DateTimeFormatOptions).format(d);
  } catch {
    // Hermes v0.79 supports islamic-umalqura; older test runners may not.
    // Fall back to ISO date string.
    return d.toISOString().split('T')[0] ?? String(date);
  }
}

export { detectLocale };
