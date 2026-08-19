/**
 * VerifyEmailPage.tsx — /verify-email
 *
 * Purpose:    Post-signup "check your email" screen with resend option.
 * Inputs:     POST /api/auth/verify-resend via Resend button
 * Outputs:    Static screen; no redirect (user must click email link)
 * SPORT:      D-S3-T3
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { ThemeToggle } from '@nself-web/ui'

export function VerifyEmailPage() {
  const t = useT('common')
  const tErrors = useT('errors')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setResendLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-resend', { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? tErrors('resendVerificationFailed'))
      } else {
        setResendSent(true)
      }
    } catch {
      setError(tErrors('networkError'))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="w-full max-w-sm text-center">
        <div className="mb-4">
          <Link to="/" className="text-2xl font-bold text-brand-primary">ɳTask</Link>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <div className="text-5xl mb-6">📧</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{t('auth.verifyEmailTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {t('auth.verifyEmailBody')}
          </p>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          {resendSent ? (
            <p className="text-sm text-green-600 dark:text-green-400 mb-4">{t('auth.verificationResent')}</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="mb-4 w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {resendLoading ? t('auth.sending') : t('auth.resendVerificationEmail')}
            </button>
          )}
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </div>
    </div>
  )
}
