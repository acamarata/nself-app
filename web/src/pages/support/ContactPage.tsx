/**
 * ContactPage.tsx — /contact — support contact page
 *
 * Purpose:    Ported from the retired web/ntask-marketing app's
 *             src/pages/contact.astro per ADR-P6-04 — this content has no
 *             equivalent elsewhere (org has no per-product contact page),
 *             so it is fully ported rather than redirected.
 * Inputs:     none
 * Outputs:    static contact page
 * SPORT:      P6-E7-W4-S1-T5
 */

export function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold">Contact</h1>
        <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">We're here to help.</p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Bug Reports & Feature Requests</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Use GitHub Issues for bugs and feature requests. Public issues help the community.
            </p>
            <a
              href="https://github.com/nself-org/ntask/issues"
              className="mt-4 inline-block rounded-lg border border-violet-500/40 px-4 py-2 text-sm text-violet-600 dark:text-violet-300 transition hover:border-violet-400"
            >
              Open an Issue →
            </a>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
            <h2 className="text-lg font-semibold">General Support</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Email us for account issues, billing, or anything you'd prefer to keep private.
            </p>
            <a
              href="mailto:hello@nself.org"
              className="mt-4 inline-block rounded-lg border border-violet-500/40 px-4 py-2 text-sm text-violet-600 dark:text-violet-300 transition hover:border-violet-400"
            >
              hello@nself.org
            </a>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
          Security vulnerabilities:{' '}
          <a href="/security" className="text-violet-600 dark:text-violet-400 hover:underline">
            security@nself.org
          </a>
        </p>
      </div>
    </div>
  )
}
