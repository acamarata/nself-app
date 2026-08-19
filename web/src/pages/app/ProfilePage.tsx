/**
 * ProfilePage.tsx — /profile — user profile + settings
 *
 * Purpose:    Port of src/app/app/profile/page.tsx.
 *             next-themes useTheme works unchanged in Vite.
 *             useRouter.replace → useNavigate.
 * Inputs:     auth.getUser + getProfile/upsertProfile from @/lib/graphql
 * Outputs:    Display name form, theme selector, sign out
 * Constraints: useNavigate replaces useRouter
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { auth } from '@/lib/api'
import { getProfile, updateProfile, updatePreferences } from '@/lib/graphql'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

type ThemePref = 'system' | 'light' | 'dark'

export function ProfilePage() {
  const t = useT('tasks')
  usePageMeta({ title: 'Profile' })
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    async function load() {
      const userResult = await auth.getUser()
      if (userResult.data) setUserEmail(userResult.data.email)

      const profile = await getProfile()
      if (profile) {
        setProfileId(profile.id)
        setDisplayName(profile.display_name || '')
      }
    }
    load()
  }, [setTheme])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (profileId) {
        await updateProfile(profileId, { display_name: displayName || undefined })
        // np_profiles pk == the user id, so profileId is the correct user_id
        // filter for UPDATE_PREFERENCES.
        await updatePreferences(profileId, { theme_preference: (theme as 'light' | 'dark' | 'system') || 'system' })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.saveFailed'))
    }
    setSaving(false)
  }

  async function handleThemeChange(t: ThemePref) {
    setTheme(t)
    if (profileId) await updatePreferences(profileId, { theme_preference: t })
  }

  async function handleSignOut() {
    await auth.signOut()
    navigate('/login', { replace: true })
  }

  const initials = (displayName || userEmail || '?')[0].toUpperCase()

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-lg mx-auto pb-24 lg:pb-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t('profile.title')}</h1>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-2xl font-bold text-brand-primary dark:text-brand-muted">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {displayName || t('profile.noNameSet')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{userEmail}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('profile.displayName')}
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder={t('profile.displayNamePlaceholder')}
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('profile.theme')}
          </span>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as ThemePref[]).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                onClick={() => handleThemeChange(themeOption)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                  (theme || 'system') === themeOption
                    ? 'border-indigo-500 bg-sky-50 dark:bg-indigo-900/20 text-brand-primary dark:text-brand-muted font-medium'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {themeOption === 'system' ? t('profile.themeSystem') : themeOption === 'light' ? t('profile.themeLight') : t('profile.themeDark')}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          {saving ? t('profile.saving') : saved ? t('profile.saved') : t('profile.saveChanges')}
        </button>
      </form>

      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg border border-red-300 dark:border-red-700 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          {t('profile.signOut')}
        </button>
      </div>
    </div>
  )
}
