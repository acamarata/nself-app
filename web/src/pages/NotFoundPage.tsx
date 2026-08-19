/**
 * NotFoundPage.tsx — 404 catch-all page
 *
 * Purpose:    Port of src/app/not-found.tsx
 * Inputs:     none
 * Outputs:    404 page with link home
 * Constraints: React Router Link
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { Link } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { ThemeToggle } from '@nself-web/ui'

export function NotFoundPage() {
  const t = useT('errors')
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white dark:bg-gray-950 px-4 py-16 text-center">
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>
      <Link
        to="/"
        className="mb-8 text-2xl font-bold text-brand-primary hover:text-indigo-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        aria-label={t('homeAriaLabel')}
      >
        ɳTask
      </Link>
      <h1 className="mb-4 text-6xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mb-2 text-xl text-gray-700 dark:text-gray-300">{t('notFound')}</p>
      <p className="mb-8 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {t('pageNotFoundDescription')}
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-md bg-brand-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        {t('returnHome')}
      </Link>
    </div>
  )
}
