/**
 * ResetPasswordPage.tsx — /reset-password
 *
 * Purpose:    Email entry form to trigger password reset email.
 * Inputs:     email form field; POST /api/auth/reset
 * Outputs:    "Check your email" success state on submit
 * Constraints: Accessible without auth; no AppShell chrome
 * SPORT:      D-S3-T2
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { ThemeToggle } from '@nself-web/ui'

export function ResetPasswordPage() {
  const t = useT('common')
  const tErrors = useT('errors')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? tErrors('sendResetEmailFailed'))
      } else {
        setSent(true)
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
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{t('auth.resetPasswordTitle')}</h1>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="mb-4 text-4xl">📬</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('auth.checkEmailResetLink')}
              </p>
              <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-primary hover:text-indigo-500">
                {t('auth.backToSignIn')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.emailAddressLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {loading ? t('auth.sending') : t('auth.sendResetLink')}
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link to="/login" className="font-medium text-brand-primary hover:text-indigo-500">
                  {t('auth.backToSignIn')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
