/**
 * SettingsPage.tsx — /settings — user settings hub
 * Purpose: Five-tab settings: Appearance, Language, Notifications, Account, Security.
 * Inputs: UserPreferences from @/lib/graphql, auth from api.ts
 * Outputs: Settings UI persisted to np_user_preferences.
 * Constraints: Tab routing via URL hash (#appearance etc.), <300 lines.
 * SPORT: D2-S5-T1
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { auth } from '@/lib/api'
import { getUserPreferences, updatePreferences } from '@/lib/graphql'
import { useScreenState } from '@/hooks/useScreenState'
import { useT, setPreferredLocale, getPreferredLocale, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'
import { getWeekStart, setWeekStart, getDateFormat, setDateFormat, type WeekStart, type DateFormat } from '@/lib/local-prefs'
import type { NpUserPreferences } from '@/lib/graphql'
import { AccountTab } from './settings/AccountTab'
import { SecurityTab } from './settings/SecurityTab'

type TabId = 'appearance' | 'language' | 'notifications' | 'account' | 'security'

const TABS: Array<{ id: TabId; labelKey: string }> = [
  { id: 'appearance', labelKey: 'settings.appearance' },
  { id: 'language', labelKey: 'settings.language' },
  { id: 'notifications', labelKey: 'settings.notifications' },
  { id: 'account', labelKey: 'settings.account' },
  { id: 'security', labelKey: 'settings.security' },
]

function getActiveTab(): TabId {
  const hash = window.location.hash.replace('#', '') as TabId
  return TABS.some((t) => t.id === hash) ? hash : 'appearance'
}

export function SettingsPage() {
  const t = useT('tasks')
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [prefs, setPrefs] = useState<NpUserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>(getActiveTab)
  const [saving, setSaving] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [weekStart, setWeekStartState] = useState<WeekStart>(getWeekStart)
  const [dateFormat, setDateFormatState] = useState<DateFormat>(getDateFormat)
  const [locale, setLocaleState] = useState<Locale>(() => getPreferredLocale() ?? 'en')

  const screen = useScreenState({ loading, data: prefs ? [prefs] : null })

  useEffect(() => {
    async function load() {
      const [userResult, prefsResult] = await Promise.all([
        auth.getUser(),
        getUserPreferences(),
      ])
      if (userResult.data) setUserEmail(userResult.data.email)
      setPrefs(prefsResult)
      if (prefsResult?.theme_preference) setTheme(prefsResult.theme_preference)
      setLoading(false)
    }
    load()
  }, [setTheme])

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
    window.location.hash = tab
  }

  async function save(partial: Partial<NpUserPreferences>) {
    if (!prefs) return
    setSaving(true)
    const updated = await updatePreferences(prefs.user_id, partial as Parameters<typeof updatePreferences>[1])
    if (updated) setPrefs(updated)
    setSaving(false)
  }

  // week_start / date_format have no backend column yet (np_user_preferences
  // only has time_format) — persisted client-side via lib/local-prefs.ts so
  // the controls are at least real instead of decorative. See that file's
  // header comment for the backend gap this depends on.
  function handleWeekStartChange(value: WeekStart) {
    setWeekStartState(value)
    setWeekStart(value)
  }

  function handleDateFormatChange(value: DateFormat) {
    setDateFormatState(value)
    setDateFormat(value)
  }

  // Persist the chosen locale and apply it. lib/i18n.ts has no reactive
  // locale store (useT() namespaces are loaded at module scope), so a full
  // reload is the reliable way to make every useT() call resolve the new
  // locale's strings — this also matches "apply on reload" in the ticket.
  function handleLocaleChange(next: Locale) {
    setLocaleState(next)
    setPreferredLocale(next)
    const rtl = next === 'ar'
    document.documentElement.lang = next
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    window.location.reload()
  }

  async function handleSignOut() {
    await auth.signOut()
    navigate('/login', { replace: true })
  }

  if (screen.isLoading) {
    return (
      <div className="px-4 py-8 text-sm text-gray-400 dark:text-gray-500 animate-pulse">
        {t('states.loading')}
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        {t('settings.title')}
      </h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`px-4 py-2 text-sm font-medium shrink-0 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.theme.title')}
            </span>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => { setTheme(th); save({ theme_preference: th }) }}
                  aria-pressed={(theme || 'system') === th}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                    (theme || 'system') === th
                      ? 'border-indigo-500 bg-sky-50 dark:bg-indigo-900/20 text-brand-primary dark:text-indigo-400 font-medium'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(`settings.theme.${th}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="week-start"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('settings.weekStart.title')}
            </label>
            <select
              id="week-start"
              value={weekStart}
              onChange={(e) => handleWeekStartChange(e.target.value as WeekStart)}
              disabled={saving}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            >
              <option value="sunday">{t('settings.weekStart.sunday')}</option>
              <option value="monday">{t('settings.weekStart.monday')}</option>
              <option value="saturday">{t('settings.weekStart.saturday')}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="date-format"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('settings.dateFormat')}
            </label>
            <select
              id="date-format"
              value={dateFormat}
              onChange={(e) => handleDateFormatChange(e.target.value as DateFormat)}
              disabled={saving}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === 'language' && (
        <div className="space-y-3">
          {([
            { code: 'en', label: 'English', dir: 'ltr' },
            { code: 'ar', label: 'العربية', dir: 'rtl' },
            { code: 'es', label: 'Español', dir: 'ltr' },
            { code: 'fr', label: 'Français', dir: 'ltr' },
          ] as const).map((lang) => {
            const isActive = locale === lang.code
            return (
              <label
                key={lang.code}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'border-brand-primary bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.code}
                  checked={isActive}
                  onChange={() => {
                    if (SUPPORTED_LOCALES.includes(lang.code)) handleLocaleChange(lang.code)
                  }}
                  className="text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lang.label}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {([
            { key: 'push', labelKey: 'settings.pushNotifications' },
            { key: 'email', labelKey: 'settings.emailNotifications' },
          ] as const).map(({ key, labelKey }) => {
            const settings = prefs?.notification_settings
            const enabled = settings?.[key] ?? false
            return (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm text-gray-900 dark:text-white">{t(labelKey)}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={saving}
                  onChange={(e) => {
                    save({
                      notification_settings: {
                        push: settings?.push ?? false,
                        email: settings?.email ?? false,
                        inApp: settings?.inApp ?? false,
                        [key]: e.target.checked,
                      },
                    })
                  }}
                  aria-label={t(labelKey)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary disabled:opacity-50"
                />
              </label>
            )
          })}
        </div>
      )}

      {activeTab === 'account' && (
        <AccountTab userEmail={userEmail} onSignOut={handleSignOut} />
      )}

      {activeTab === 'security' && <SecurityTab />}
    </div>
  )
}
