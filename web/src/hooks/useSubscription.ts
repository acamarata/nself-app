/**
 * useSubscription.ts — React hook for graphql-ws subscriptions
 *
 * Purpose:    Subscribe to a GraphQL subscription query; auto-cleanup on unmount.
 * Inputs:     query string; optional variables; enabled flag
 * Outputs:    { data, loading, error } — reactive to server events
 * Constraints: Falls back silently if WS unavailable; no-op when !enabled
 * SPORT:      D-S5-T1
 */
import { useEffect, useState, useRef } from 'react'
import { getWsClient } from '@/lib/graphql-ws-client'

interface SubscriptionResult<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useSubscription<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { enabled?: boolean },
): SubscriptionResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const enabled = options?.enabled !== false
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let disposed = false

    try {
      const client = getWsClient()
      const unsub = client.subscribe<T>(
        { query, variables },
        {
          next: (value) => {
            if (disposed) return
            if (value.data !== undefined) {
              setData(value.data)
              setLoading(false)
            }
          },
          error: (err) => {
            if (disposed) return
            setError(err instanceof Error ? err.message : 'Subscription error')
            setLoading(false)
          },
          complete: () => {
            if (disposed) return
            setLoading(false)
          },
        },
      )
      unsubRef.current = unsub
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe')
      setLoading(false)
    }

    return () => {
      disposed = true
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [query, JSON.stringify(variables), enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error }
}
