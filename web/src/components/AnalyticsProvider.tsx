/**
 * AnalyticsProvider — injects Plausible Analytics for task.nself.org
 *
 * Purpose:    Privacy-friendly analytics (no cookies, GDPR/CCPA compliant).
 *             Replaced next/script with imperative DOM injection for Vite SPA.
 * Inputs:     none
 * Outputs:    <script> tag appended to document.head in production
 * Constraints: no-op in dev mode; cleanup on unmount
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { useEffect } from 'react'

const PLAUSIBLE_DOMAIN = 'task.nself.org'
const PLAUSIBLE_SRC =
  import.meta.env.VITE_PLAUSIBLE_SRC ||
  'https://analytics.nself.org/js/script.tagged-events.js'

export function AnalyticsProvider() {
  useEffect(() => {
    if (import.meta.env.DEV) return

    const script = document.createElement('script')
    script.defer = true
    script.setAttribute('data-domain', PLAUSIBLE_DOMAIN)
    script.src = PLAUSIBLE_SRC
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  return null
}
