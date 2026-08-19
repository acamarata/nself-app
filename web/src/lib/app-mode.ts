/**
 * app-mode.ts — Native-app-shell detection for task.nself.org
 *
 * Purpose:    task.nself.org is served both as a normal marketing/SaaS website
 *             (browser visitors) AND as the frontend loaded inside the Tauri
 *             desktop shell (and eventually mobile/TV webviews). When loaded
 *             inside a native shell it must feel like a native app — no
 *             marketing header/footer/cookie-banner chrome. isAppMode()
 *             detects that context via three signals (checked in order):
 *               1. `?app=<anything>` query param present on the current URL
 *                  (e.g. the Tauri window URL .../welcome?app=desktop) — this
 *                  also persists a localStorage flag so app-mode survives
 *                  client-side navigation once the query param is gone.
 *               2. The persisted localStorage flag from a prior visit.
 *               3. navigator.userAgent containing 'ɳTask' or 'nTaskDesktop'
 *                  (reserved for a future custom Tauri user-agent override).
 * Inputs:     window.location.search, localStorage, navigator.userAgent
 * Outputs:    boolean — true when the app should suppress marketing chrome
 * Constraints: Must be safe to call during SSR-less Vite/SPA render (guards
 *              around `window`/`localStorage` for test environments); must be
 *              idempotent — calling it repeatedly should not flip state.
 * SOT:        Desktop app-mode chrome suppression (native-app-feel task)
 */

const STORAGE_KEY = 'ntask_app_mode'
const APP_MODE_USER_AGENTS = ['ɳTask', 'nTaskDesktop']

/**
 * Returns true when the app is running inside a native shell (Tauri desktop,
 * and future mobile/TV webviews) and should render without marketing chrome
 * (Header/Footer/CookieBanner). Persists detection via localStorage so the
 * app stays in app-mode across client-side route changes after the initial
 * `?app=` query param is gone from the URL.
 */
export function isAppMode(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.has('app')) {
      window.localStorage?.setItem(STORAGE_KEY, '1')
      return true
    }

    if (window.localStorage?.getItem(STORAGE_KEY) === '1') {
      return true
    }
  } catch {
    // localStorage unavailable (e.g. privacy mode, test env) — fall through
    // to user-agent detection only.
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : ''
  return APP_MODE_USER_AGENTS.some((marker) => ua.includes(marker))
}
