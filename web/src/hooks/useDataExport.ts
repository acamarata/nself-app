/**
 * useDataExport.ts — data export request hook
 *
 * Purpose:    GET /api/account/export to trigger an async data export.
 *             Returns a signed download URL on success.
 *             429 responses set error = 'rate_limited' (24-hour cooldown).
 * Inputs:     none (auth identity from httpOnly cookie)
 * Outputs:    { requestExport, loading, error }
 * Constraints: Caller handles window.open(); hook only obtains the URL.
 * SPORT:      J-S1-T2
 */
import { useState, useCallback } from 'react'

interface ExportResponse {
  url: string
}

interface UseDataExportReturn {
  requestExport: () => Promise<string | null>
  loading: boolean
  error: string | null
}

export function useDataExport(): UseDataExportReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestExport = useCallback(async (): Promise<string | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/account/export', {
        method: 'GET',
        credentials: 'include',
      })
      if (response.status === 429) {
        setError('rate_limited')
        return null
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? `Request failed (${response.status})`)
        return null
      }
      const json: ExportResponse = await response.json()
      return json.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { requestExport, loading, error }
}
