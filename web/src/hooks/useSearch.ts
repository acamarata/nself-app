/**
 * useSearch.ts — Debounced full-text task search hook
 * Purpose: Wrap searchTodos with 300ms debounce, min 2 chars, loading state.
 * Inputs:  query: string
 * Outputs: { results: NpTaskSummary[], loading: boolean, error: boolean }
 * Constraints: ≤60 lines. Does not own any UI.
 * SPORT: D2-S7-T2
 */
import { useEffect, useRef, useState } from 'react'
import { searchTodos } from '@/lib/graphql'
import type { NpTaskSummary } from '@/lib/graphql'

export interface UseSearchResult {
  results: NpTaskSummary[]
  loading: boolean
  error: boolean
}

/**
 * Debounced search hook over np_todos.
 * Skips requests when query length < 2.
 */
export function useSearch(query: string): UseSearchResult {
  const [results, setResults] = useState<NpTaskSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = query.trim()

    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }

    setLoading(true)
    setError(false)

    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchTodos(trimmed)
        setResults(data)
      } catch {
        setError(true)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  return { results, loading, error }
}
