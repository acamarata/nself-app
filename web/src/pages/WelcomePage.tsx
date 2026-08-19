/**
 * WelcomePage.tsx — Native-app splash / entry point ("Welcome -> Login -> app")
 *
 * Purpose:    First screen shown by the desktop (and future mobile/TV) shell:
 *             a clean, chrome-free splash with the ɳTask mark, a one-line
 *             tagline, and two calls to action. No marketing header/footer/
 *             cookie-banner — those are suppressed globally in app-mode by
 *             AppShell. Also reachable in a normal browser at /welcome.
 * Inputs:     none
 * Outputs:    Static splash UI; navigates to /login or /signup on CTA click
 * Constraints: <=120 lines; theme-aware (light/dark/system via next-themes,
 *              already wired at the app root); no header/footer/cookie chrome
 * SOT:        Desktop native-app-feel task — Welcome -> Login -> app flow
 */
import { Link } from 'react-router-dom'
import { Logo } from '@nself-web/ui'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

export function WelcomePage() {
  usePageMeta({
    title: 'Welcome',
    description: 'Tasks that work the way you do.',
  })
  const t = useT('marketing')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-950 px-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        <Logo className="h-12 w-auto text-gray-900 dark:text-white" product="Task" />

        <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
          {t('welcome.tagline')}
        </p>

        <Link
          to="/login"
          className="mt-10 w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-colors"
        >
          {t('welcome.getStarted')}
        </Link>

        <Link
          to="/signup"
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          {t('welcome.createAccount')}
        </Link>
      </div>
    </div>
  )
}
