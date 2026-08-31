/**
 * CookiesPage.tsx — /legal/cookies redirect
 *
 * Purpose:    Immediately redirects to the canonical Cookie Policy on nself.org.
 *             Satisfies in-app link requirements without duplicating content.
 *             ɳTask-specific cookie details (session + preference cookies,
 *             no tracking cookies) are folded into that page's "ɳTask
 *             Service-Specific Cookies" section per ADR-P6-04 (retirement
 *             of web/ntask-marketing).
 * Inputs:     none
 * Outputs:    window.location.replace() to nself.org/cookies
 * Constraints: Must show fallback text before redirect fires (SSR-safe pattern).
 * SPORT:      P6-E7-W4-S1-T5
 */
import { useEffect } from 'react'

const COOKIES_URL = 'https://nself.org/cookies'

export function CookiesPage() {
  useEffect(() => {
    window.location.replace(COOKIES_URL)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to Cookie Policy…</p>
    </div>
  )
}
