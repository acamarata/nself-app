/**
 * Purpose: Registers this app's per-surface locale files (src/i18n/<locale>/*.json)
 *          as i18next namespaces, so useTranslation() can resolve keys like
 *          t('nav:calendar') in app screens.
 * Inputs: The 16 JSON files (4 locales x common/dates/nav/screens namespaces) and
 *         the initialized i18next instance to attach them to.
 * Outputs: MOBILE_RESOURCES bundle map; registerMobileResources(instance).
 * Constraints:
 *   - The instance must already be initialized (initializeI18n ensures that);
 *     i18next only exposes addResourceBundle after init() runs.
 *   - The caller passes the exact instance app code resolves: with
 *     node-linker=hoisted the vendored @nself/i18n resolves its own nested
 *     i18next copy, so registering on the package's instance would never reach
 *     components importing react-i18next from the app tree.
 *   - Idempotent: safe on every initializeI18n() call (language switches).
 *   - Locale coverage must match the src/i18n/ directories enforced against the
 *     en baseline by scripts/check-i18n-completeness.ts (CI gate).
 * SPORT: MB-4 calendar view — first consumer of t() against app-level namespaces
 */

import type i18next from 'i18next';
import enCommon from './en/common.json';
import enDates from './en/dates.json';
import enNav from './en/nav.json';
import enScreens from './en/screens.json';
import arCommon from './ar/common.json';
import arDates from './ar/dates.json';
import arNav from './ar/nav.json';
import arScreens from './ar/screens.json';
import frCommon from './fr/common.json';
import frDates from './fr/dates.json';
import frNav from './fr/nav.json';
import frScreens from './fr/screens.json';
import esCommon from './es/common.json';
import esDates from './es/dates.json';
import esNav from './es/nav.json';
import esScreens from './es/screens.json';

type Namespaces = Record<'common' | 'dates' | 'nav' | 'screens', Record<string, unknown>>;

const MOBILE_RESOURCES: Record<'en' | 'ar' | 'fr' | 'es', Namespaces> = {
  en: { common: enCommon, dates: enDates, nav: enNav, screens: enScreens },
  ar: { common: arCommon, dates: arDates, nav: arNav, screens: arScreens },
  fr: { common: frCommon, dates: frDates, nav: frNav, screens: frScreens },
  es: { common: esCommon, dates: esDates, nav: esNav, screens: esScreens },
};

/** Attach every app-level namespace bundle to the given i18next instance. */
export function registerMobileResources(instance: typeof i18next): void {
  for (const [lng, namespaces] of Object.entries(MOBILE_RESOURCES) as [string, Namespaces][]) {
    for (const [ns, data] of Object.entries(namespaces) as [keyof Namespaces, Record<string, unknown>][]) {
      instance.addResourceBundle(lng, ns, data, true, true);
    }
  }
}
