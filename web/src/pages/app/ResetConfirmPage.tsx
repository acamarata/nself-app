/**
 * ResetConfirmPage.tsx — /reset-confirm?refreshToken=<token>
 *
 * Purpose:    New password form; reads the reset token from the URL query.
 * Inputs:     ?refreshToken= URL param; new password form; POST /api/auth/reset-confirm
 * Outputs:    Redirect to /login on success
 * Constraints: No auth guard; accessible from email link.
 *              hasura-auth consumes the emailed ticket itself and redirects here
 *              with ?refreshToken=, so there is no ticket to read.
 * SPORT:      D-S3-T2
 */
import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { ThemeToggle } from '@nself-web/ui'

export function ResetConfirmPage() {
  const t = useT('common')
  const tErrors = useT('errors')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refreshToken = searchParams.get('refreshToken') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!refreshToken) { setError(tErrors('invalidResetLink')); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? tErrors('resetPasswordFailed'))
      } else {
        navigate('/login', { replace: true, state: { message: t('auth.passwordUpdatedSignIn') } })
      }
    } catch {
      setError(tErrors('networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-primary">ɳTask</Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{t('auth.setNewPasswordTitle')}</h1>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
            {!refreshToken && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{tErrors('invalidResetLink')}</p>
              </div>
            )}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.newPasswordLabel')}
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder={t('auth.newPasswordPlaceholder')}
                disabled={!refreshToken}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !refreshToken}
              className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {loading ? t('auth.updatingPassword') : t('auth.updatePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
