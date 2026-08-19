/**
 * AupPage.tsx — /legal/aup redirect
 *
 * Purpose:    Immediately redirects to the canonical Acceptable Use Policy on nself.org.
 *             Satisfies in-app link requirements without duplicating content.
 * Inputs:     none
 * Outputs:    window.location.replace() to nself.org/aup
 * Constraints: Must show fallback text before redirect fires (SSR-safe pattern).
 * SPORT:      J-S1-T3
 */
import { useEffect } from 'react'

const AUP_URL = 'https://nself.org/aup'

export function AupPage() {
  useEffect(() => {
    window.location.replace(AUP_URL)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to Acceptable Use Policy…</p>
    </div>
  )
}
