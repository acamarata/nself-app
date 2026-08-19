/**
 * HomePage.tsx — Landing for task.nself.org (ɳTask hosted SaaS)
 *
 * Purpose:    Show off the actual ɳTask app (like any great tasks app) and drive
 *             Sign up / Log in. task.nself.org is the FREE HOSTED version of the
 *             open-source ɳTask app you can also self-host — that's noted, but the
 *             page is focused on the product + getting people into the app.
 * Inputs:     none
 * Outputs:    App-showcase landing: hero + features + cross-platform + self-host note + CTA.
 *             Authenticated-visitor redirect (straight into /lists) happens one level up in
 *             AppShell.tsx — task.nself.org IS the app; this component only renders the
 *             logged-out marketing landing and must not duplicate that redirect logic.
 * Constraints: React Router Link for internal; <a> for external; full dark-mode support
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { Link } from 'react-router-dom'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

const FEATURE_KEYS = [
  'listsSubtasks',
  'dueDatesReminders',
  'recurringTasks',
  'tagsFilterSearch',
  'shareCollaborate',
  'offlineFirst',
] as const

const PLATFORM_KEYS = ['web', 'desktop', 'mobile', 'tv'] as const

export function HomePage() {
  // usePageMeta appends " — ɳTask" itself — pass only the page-specific title
  // here or the brand suffix doubles up (index.html's static <title> already
  // has the full "ɳTask — Tasks that work the way you do" for first paint).
  usePageMeta({
    title: 'Tasks that work the way you do',
    description:
      'A fast, beautiful task manager: lists, subtasks, reminders, recurring tasks, sharing, and offline sync. Free hosted at task.nself.org — or self-host the open-source app.',
    ogImage: 'https://task.nself.org/api/og?title=%C9%B3Task',
  })
  const t = useT('marketing')
  const features = FEATURE_KEYS.map((key) => ({
    key,
    title: t(`home.features.${key}.title`),
    description: t(`home.features.${key}.description`),
  }))
  const platforms = PLATFORM_KEYS.map((key) => ({
    key,
    name: t(`home.platforms.${key}.name`),
    detail: t(`home.platforms.${key}.detail`),
  }))

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      {/* Hero — product + signup focus */}
      <section className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
            {t('home.heroTitlePart1')}
            <span className="text-brand-primary">{t('home.heroTitleHighlight')}</span>
          </h1>
          <p className="mb-10 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('home.heroSubtitle')}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-md bg-brand-primary px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              {t('home.signUpFree')}
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-8 py-3 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              {t('home.logIn')}
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {t('home.freeHostedPrefix')}{' '}
            <a
              href="https://nself.org/products/ntask"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-primary hover:underline"
            >
              {t('home.selfHostLinkText')}
            </a>{' '}
            {t('home.freeHostedSuffix')}
          </p>
        </div>
      </section>

      {/* App preview */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-gray-400">task.nself.org/app</span>
          </div>
          {/* Lightweight static preview of the app UI (screenshot replaces this — see BRAND-ASSETS) */}
          <div className="grid gap-4 p-6 sm:grid-cols-[180px_1fr]">
            <aside className="hidden sm:flex flex-col gap-2 text-sm">
              {['Today', 'Upcoming', 'Work', 'Personal', 'Shopping'].map((l, i) => (
                <div key={l} className={`rounded-md px-3 py-2 ${i === 0 ? 'bg-brand-primary/10 text-brand-primary font-medium' : 'text-gray-600 dark:text-gray-400'}`}>{l}</div>
              ))}
            </aside>
            <div className="flex flex-col gap-2">
              {[
                { t: 'Finish Q3 roadmap', done: false, tag: 'Work', pri: 'bg-red-400' },
                { t: 'Review pull requests', done: false, tag: 'Work', pri: 'bg-amber-400' },
                { t: 'Book dentist', done: true, tag: 'Personal', pri: 'bg-gray-300' },
                { t: 'Plan weekend trip', done: false, tag: 'Personal', pri: 'bg-sky-400' },
              ].map((row) => (
                <div key={row.t} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
                  <span className={`h-4 w-4 rounded-full border-2 ${row.done ? 'border-brand-primary bg-brand-primary' : 'border-gray-300 dark:border-gray-600'}`} />
                  <span className={`flex-1 text-sm ${row.done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{row.t}</span>
                  <span className={`h-2 w-2 rounded-full ${row.pri}`} />
                  <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">{row.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features — what the app does */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-center text-3xl font-bold text-gray-900 dark:text-white">
            {t('home.featuresHeading')}
          </h2>
          <p className="mb-16 text-center text-gray-500 dark:text-gray-400">
            {t('home.featuresSubheading')}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-platform */}
      <section className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{t('home.platformsHeading')}</h2>
          <p className="mb-12 text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            {t('home.platformsSubheading')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {platforms.map((p) => (
              <div key={p.key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{p.name}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{p.detail}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            {t('home.platformsFooterNote')}
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{t('home.ctaHeading')}</h2>
          <p className="mb-8 text-gray-600 dark:text-gray-400">
            {t('home.ctaSubheading')}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-md bg-brand-primary px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-hover transition-colors"
            >
              {t('home.signUpFree')}
            </Link>
            <a
              href="https://nself.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-8 py-3 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('home.aboutNself')}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
