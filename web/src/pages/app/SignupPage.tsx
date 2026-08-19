/**
 * SignupPage.tsx — /signup registration form
 *
 * Purpose:    Port of src/app/app/signup/page.tsx.
 * Inputs:     displayName + email + password; auth.signUp + auth.signIn
 * Outputs:    Seeds default list and redirects to /lists/:id
 * Constraints: useNavigate replaces useRouter; React Router Link
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth, gql } from '@/lib/api'
import { createList, createTodo } from '@/lib/graphql'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useAuth } from '@/lib/auth-context'
import { useT } from '@/lib/i18n'
import { ThemeToggle } from '@nself-web/ui'

const TOS_VERSION = '1.0'

// Records ToS acceptance on the user's np_profiles row.
// One-off mutation — not extracted to graphql.ts since it runs only at signup.
async function recordTosAcceptance(userId: string): Promise<void> {
  await gql<unknown>(
    `mutation RecordTosAcceptance($userId: String!, $version: String!, $ts: timestamptz!) {
       update_np_profiles(
         where: { user_id: { _eq: $userId } }
         _set: { tos_accepted_at: $ts, tos_version: $version }
       ) { affected_rows }
     }`,
    { userId, version: TOS_VERSION, ts: new Date().toISOString() }
  )
}

export function SignupPage() {
  usePageMeta({ title: 'Get Started Free', description: 'Create your free ɳTask account. No credit card needed.' })
  const navigate = useNavigate()
  const { refetch } = useAuth()
  const t = useT('common')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const signupResult = await auth.signUp(email, password, { displayName })
    if (signupResult.error) {
      setError(signupResult.error.message)
      setLoading(false)
      return
    }

    const signInResult = await auth.signIn(email, password)
    if (signInResult.error) {
      setError(signInResult.error.message)
      setLoading(false)
      return
    }

    const userId = signInResult.data?.user?.id
    if (userId) {
      await recordTosAcceptance(userId)
    }

    const list = await createList({ title: 'My Tasks', color: '#6366f1', icon: 'list' })
    if (list) {
      await createTodo({ list_id: list.id, title: 'Welcome to ɳTask', priority: 'none' })
    }
    await refetch()
    navigate('/verify-email')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-primary">
            ɳTask
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{t('auth.getStartedFree')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('auth.noCreditCardNeeded')}</p>
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
                htmlFor="displayName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('auth.nameLabel')}
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder={t('auth.namePlaceholder')}
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder={t('auth.newPasswordPlaceholder')}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                disabled={loading}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary disabled:opacity-50"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('auth.agreeToTermsPrefix')}{' '}
                <a
                  href="https://nself.org/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-primary hover:text-indigo-500 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('auth.termsOfService')}
                </a>{' '}
                {t('auth.and')}{' '}
                <a
                  href="https://nself.org/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-primary hover:text-indigo-500 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('auth.privacyPolicy')}
                </a>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !tosAccepted}
              className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login" className="font-medium text-brand-primary hover:text-indigo-500">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
