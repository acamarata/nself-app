/**
 * SearchBar.tsx — Task search input with debounce
 * Purpose: Debounced search input calling searchTodos API.
 * Inputs: onResults(results: NpTaskSummary[]) callback, placeholder text
 * Outputs: Search input with loading state + clear button.
 * Constraints: 300ms debounce, min 2 chars, <150 lines.
 * SPORT: D2-S3
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { searchTodos } from '@/lib/graphql'
import type { NpTaskSummary } from '@/lib/graphql'

interface SearchBarProps {
  onResults: (results: NpTaskSummary[]) => void
  initialQuery?: string
  onQueryChange?: (q: string) => void
}

export function SearchBar({ onResults, initialQuery = '', onQueryChange }: SearchBarProps) {
  const t = useT('tasks')
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim() || query.trim().length < 2) {
      setLoading(false)
      onResults([])
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const results = await searchTodos(query.trim())
      setLoading(false)
      onResults(results)
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    onQueryChange?.(val)
  }

  function handleClear() {
    setQuery('')
    onQueryChange?.('')
    onResults([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') handleClear()
  }

  return (
    <div className="relative flex items-center">
      <div className="pointer-events-none absolute left-3 flex items-center" aria-hidden="true">
        {loading ? (
          <svg className="h-4 w-4 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        autoComplete="off"
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-8 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
      />

      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
