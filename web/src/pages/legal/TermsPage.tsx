/**
 * TermsPage.tsx — /legal/terms redirect
 *
 * Purpose:    Immediately redirects to the canonical Terms of Service on nself.org.
 *             Satisfies in-app link requirements without duplicating content.
 * Inputs:     none
 * Outputs:    window.location.replace() to nself.org/terms
 * Constraints: Must show fallback text before redirect fires (SSR-safe pattern).
 * SPORT:      J-S1-T3
 */
import { useEffect } from 'react'
import { ThemeToggle } from '@nself-web/ui'

const TERMS_URL = 'https://nself.org/terms'

export function TermsPage() {
  useEffect(() => {
    window.location.replace(TERMS_URL)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="fixed top-4 right-4 z-10"><ThemeToggle /></div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to Terms of Service…</p>
    </div>
  )
}
