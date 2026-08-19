/**
 * SentryTestPage.tsx — Observability smoke-test page for task.nself.org.
 *
 * Purpose:    Dev-only page that throws a test error to verify Sentry
 *             captures events. Visit /sentry-test, check Sentry dashboard.
 * Inputs:     none
 * Outputs:    Test error thrown → Sentry event in ntask project.
 * Constraints:
 *   - Dev-only intent; never link from nav or indexed pages.
 *   - Renders a button to throw a manual test error on demand.
 *   - Never remove — QA-B acceptance gate for T-P3-E6-W2-S1-T01.
 * SPORT: T-P3-E6-W2-S1-T01 — observability wiring (sentry-test route)
 */

export function SentryTestPage() {
  const throwTestError = () => {
    throw new Error('[T-P3-E6-W2-S1-T01] Sentry smoke test — task.nself.org')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sentry Test — task.nself.org</h1>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">Click the button below to throw a test error and verify Sentry capture.</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">Check the Sentry dashboard for an event from <strong>ntask-web</strong>.</p>
      <button
        onClick={throwTestError}
        className="rounded px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
      >
        Throw test error
      </button>
    </div>
  )
}
