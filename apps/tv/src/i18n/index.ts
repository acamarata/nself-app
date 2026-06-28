/**
 * Purpose: TV app i18n initialization — standalone i18next setup for TV-specific namespaces.
 * Inputs: device locale from expo-localization
 * Outputs: initializeI18n() sets up i18next with 'common' + 'screens' namespaces for 4 locales.
 *          useTVTranslation(ns) hook returns a typed t() for the given namespace.
 *          getDeviceLocale() returns the detected locale string.
 * Constraints:
 *   - Uses i18next namespaces ('common' and 'screens') for per-domain translation keys.
 *   - RTL for Arabic via I18nManager.forceRTL.
 *   - TV supports 4 locales: en / ar / fr / es. Falls back to 'en' for any other device locale.
 *   - initializeI18n() must be called synchronously before rendering the app tree.
 *   - Does NOT use @nself/i18n's initializeI18next — TV has its own namespace structure.
 *     NselfI18nProvider from @nself/i18n is used as a provider shell only.
 * SPORT: F-S2-T6 (i18n TV wave)
 */

import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { I18nManager } from 'react-native'
import { getLocales } from 'expo-localization'
import { isRTL } from '@nself/i18n'

import enCommon from './en/common.json'
import enScreens from './en/screens.json'
import arCommon from './ar/common.json'
import arScreens from './ar/screens.json'
import frCommon from './fr/common.json'
import frScreens from './fr/screens.json'
import esCommon from './es/common.json'
import esScreens from './es/screens.json'

// ─── Supported locales ─────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['en', 'ar', 'fr', 'es'] as const
export type TVLocale = (typeof SUPPORTED_LOCALES)[number]

// ─── Locale detection ──────────────────────────────────────────────────────────

/**
 * Detect the device locale, falling back to 'en' if not supported.
 */
export function getDeviceLocale(): TVLocale {
  try {
    const locales = getLocales()
    const bcp47 = locales[0]?.languageTag ?? 'en'
    const lang = bcp47.split('-')[0]?.toLowerCase() as TVLocale
    return (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(lang) ? lang : 'en'
  } catch {
    return 'en'
  }
}

// ─── i18n initialization ───────────────────────────────────────────────────────

/**
 * Initialize i18next for the TV app.
 * Must be called synchronously before rendering.
 *
 * Sets up:
 *  - Two namespaces: 'common' (shared labels) + 'screens' (screen-specific strings)
 *  - Four locales: en / ar / fr / es
 *  - RTL layout for Arabic via I18nManager.forceRTL
 *
 * @param overrideLocale — optional override for testing
 */
export function initializeI18n(overrideLocale?: string): void {
  const locale: TVLocale =
    overrideLocale !== undefined &&
    (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(overrideLocale)
      ? (overrideLocale as TVLocale)
      : getDeviceLocale()

  // Apply RTL layout for Arabic
  const shouldBeRTL = isRTL(locale)
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL)
  }

  if (i18next.isInitialized) {
    void i18next.changeLanguage(locale)
    return
  }

  void i18next
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: enCommon, screens: enScreens },
        ar: { common: arCommon, screens: arScreens },
        fr: { common: frCommon, screens: frScreens },
        es: { common: esCommon, screens: esScreens },
      },
      lng: locale,
      fallbackLng: 'en',
      defaultNS: 'common',
      ns: ['common', 'screens'],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })
}
