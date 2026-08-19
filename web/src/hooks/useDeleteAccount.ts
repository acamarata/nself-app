/**
 * useDeleteAccount.ts — account deletion hook
 *
 * Purpose:    POST /api/account/delete with credentials, returning success flag.
 *             Caller is responsible for sign-out + navigation after true return.
 * Inputs:     none (auth identity from httpOnly cookie)
 * Outputs:    { deleteAccount, loading, error }
 * Constraints: No retry — deletion is irreversible. Error string is UI-safe.
 * SPORT:      J-S1-T2
 */
import { useState, useCallback } from 'react'

interface UseDeleteAccountReturn {
  deleteAccount: () => Promise<boolean>
  loading: boolean
  error: string | null
}

export function useDeleteAccount(): UseDeleteAccountReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? `Request failed (${response.status})`)
        return false
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { deleteAccount, loading, error }
}
