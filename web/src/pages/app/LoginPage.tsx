/**
 * LoginPage.tsx — /login sign-in form
 *
 * Purpose:    Port of src/app/app/login/page.tsx (legacy Next.js source path; mounted at /login).
 * Inputs:     email + password form fields; auth.signIn from @/lib/api
 * Outputs:    Session cookie on success → redirect to /lists
 * Constraints: useNavigate replaces useRouter; React Router Link
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n'
import { usePageMeta } from '@/hooks/usePageMeta'
import { ThemeToggle } from '@nself-web/ui'

export function LoginPage() {
  usePageMeta({ title: 'Sign In', description: 'Sign in to your ɳTask account.' })
  const navigate = useNavigate()
  const { user, loading: authLoading, refetch } = useAuth()
  const t = useT('common')
  const _tErrors = useT('errors')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Desktop app (and any deep link) opens straight to /login. If the session
  // is already authenticated (persisted cookie/token), bounce into the app
  // instead of showing the sign-in form again — this is the "single window,
  // login-first, then straight into the app" desktop UX contract.
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/lists', { replace: true })
    }
  }, [user, authLoading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await auth.signIn(email, password)
    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    // Refresh the auth context so AppShell sees the authenticated user
    // before we navigate — otherwise the /app guard bounces back to login.
    await refetch()
    navigate('/lists')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-primary">
            ɳTask
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{t('auth.welcomeBack')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('auth.signInPrompt')}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('auth.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('auth.passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder={t('auth.passwordPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link to="/reset-password" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs">
              Forgot password?
            </Link>
          </p>

          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('auth.noAccount')}{' '}
            <Link
              to="/signup"
              className="font-medium text-brand-primary hover:text-indigo-500"
            >
              {t('auth.signUpFree')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
