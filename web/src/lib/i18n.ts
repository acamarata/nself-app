/**
 * i18n.ts — Lightweight i18n helper for ntask app (Vite SPA).
 *
 * Reads translations from src/i18n/{locale}/ namespace JSON files.
 * API compatible with cloud/nsentry pattern.
 *
 * SPORT: T-P3-E6-W1-S1-T02 — web i18n string extraction
 */

import enCommon from '../i18n/en/common.json'
import enNav from '../i18n/en/nav.json'
import enMarketing from '../i18n/en/marketing.json'
import enErrors from '../i18n/en/errors.json'
import enTasks from '../i18n/en/tasks.json'

export const SUPPORTED_LOCALES = ['en', 'ar', 'fr', 'es'] as const
export const DEFAULT_LOCALE = 'en' as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** localStorage key for the user's explicitly-chosen locale (SettingsPage → Language tab). */
const LOCALE_STORAGE_KEY = 'ntask_preferred_locale'

function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Persist the user's chosen locale so it survives reload/next visit, taking
 * priority over navigator.language detection (see main.tsx boot sequence).
 * localStorage-only for now — np_user_preferences has no language column yet
 * (would need a backend migration to sync across devices).
 */
export function setPreferredLocale(locale: Locale): void {
  try {
    window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // localStorage unavailable (privacy mode, SSR, tests) — in-session only
  }
}

/** Read the persisted locale choice, if any and still supported. */
export function getPreferredLocale(): Locale | null {
  try {
    const stored = window.localStorage?.getItem(LOCALE_STORAGE_KEY)
    return stored && isSupportedLocale(stored) ? stored : null
  } catch {
    return null
  }
}

type NestedRecord = { [key: string]: string | NestedRecord }

const namespaces: Record<string, NestedRecord> = {
  common: enCommon as unknown as NestedRecord,
  nav: enNav as unknown as NestedRecord,
  marketing: enMarketing as unknown as NestedRecord,
  errors: enErrors as unknown as NestedRecord,
  tasks: enTasks as unknown as NestedRecord,
}

/**
 * Dynamically load a locale's namespace bundle and merge into the registry.
 * Call this on locale switch before rendering locale-specific UI.
 * Falls back silently to existing (en) namespace if the import fails.
 */
export async function loadNamespace(locale: Locale, namespace: string): Promise<void> {
  if (locale === DEFAULT_LOCALE) return // en is already loaded statically
  try {
    const mod = await import(`../i18n/${locale}/${namespace}.json`)
    namespaces[`${locale}:${namespace}`] = mod.default as unknown as NestedRecord
  } catch {
    // locale file missing — fall back to default locale silently
  }
}

function resolve(obj: NestedRecord, path: string): string {
  const parts = path.split('.')
  let current: string | NestedRecord = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return path
    current = (current as NestedRecord)[part]
  }
  return typeof current === 'string' ? current : path
}

/**
 * Initialize all namespaces for the given locale.
 * Call this once at app startup for non-English locales.
 * Falls back gracefully if locale files are missing.
 */
export async function initLocale(locale: Locale): Promise<void> {
  if (locale === DEFAULT_LOCALE) return
  const namespaceNames = ['common', 'nav', 'marketing', 'errors', 'tasks']
  await Promise.all(namespaceNames.map((ns) => loadNamespace(locale, ns)))
}

/**
 * Returns a translation function scoped to a namespace.
 * Checks locale-keyed namespace first, falls back to English.
 *
 * Usage:
 *   const t = useT('common', 'fr')
 *   t('loading')   // → "Chargement..."
 *   const tTasks = useT('tasks')
 *   tTasks('subtasks.title')  // → "Subtasks"
 */
export function useT(namespace: string, locale?: Locale) {
  const resolvedLocale = locale ?? DEFAULT_LOCALE
  const localeKey = resolvedLocale !== DEFAULT_LOCALE ? `${resolvedLocale}:${namespace}` : namespace
  const ns = namespaces[localeKey] ?? namespaces[namespace] ?? {}
  return function t(key: string): string { return resolve(ns as NestedRecord, key) }
}
