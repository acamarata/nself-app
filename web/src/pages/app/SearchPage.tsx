/**
 * SearchPage.tsx — /search — full-text task search
 * Purpose: Search page with SearchBar + result list.
 * Inputs: q= URL param for sharable search links.
 * Outputs: Search results as task title rows.
 * Constraints: Syncs query to URL, <200 lines.
 * SPORT: D2-S3 search page
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchBar } from '@/components/tasks/SearchBar'
import { useScreenState } from '@/hooks/useScreenState'
import { useT } from '@/lib/i18n'
import { searchTodos } from '@/lib/graphql'
import type { NpTaskSummary } from '@/lib/graphql'
import clsx from 'clsx'

const PRIORITY_COLORS: Record<string, string> = {
  none: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  low: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  medium: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  high: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

function ResultRow({ task }: { task: NpTaskSummary }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
      <div
        className={clsx(
          'flex-shrink-0 h-4 w-4 rounded-full border-2',
          task.completed
            ? 'bg-brand-primary border-indigo-600'
            : 'border-gray-300 dark:border-gray-600'
        )}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm truncate',
            task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'
          )}
        >
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(task.due_date).toLocaleDateString(document.documentElement.lang || 'en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      {task.priority && task.priority !== 'none' && (
        <span
          className={clsx(
            'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
            PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.none
          )}
        >
          {task.priority}
        </span>
      )}
    </div>
  )
}

export function SearchPage() {
  const t = useT('tasks')
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [results, setResults] = useState<NpTaskSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [activeQuery, setActiveQuery] = useState(initialQ)

  const screen = useScreenState({
    loading,
    data: activeQuery.length >= 2 ? results : null,
  })

  useEffect(() => {
    if (!initialQ || initialQ.length < 2) return
    let cancelled = false
    setLoading(true)
    searchTodos(initialQ).then((res) => {
      if (!cancelled) {
        setResults(res)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleResults(res: NpTaskSummary[]) {
    setResults(res)
    setLoading(false)
  }

  function handleQueryChange(q: string) {
    setActiveQuery(q)
    if (q.trim().length >= 2) {
      setLoading(true)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('q', q.trim())
        return next
      })
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('q')
        return next
      })
    }
  }

  const showEmpty = !screen.isLoading && activeQuery.length >= 2 && results.length === 0
  const showResults = !screen.isLoading && results.length > 0
  const showHint = activeQuery.length < 2 && activeQuery.length > 0

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        {t('search.title')}
      </h1>

      <SearchBar
        onResults={handleResults}
        initialQuery={initialQ}
        onQueryChange={handleQueryChange}
      />

      <div className="mt-4">
        {screen.isLoading && (
          <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse py-4 text-center">
            {t('states.loading')}
          </p>
        )}

        {showHint && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            {t('search.typeHint')}
          </p>
        )}

        {showEmpty && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            {t('search.noResults').replace('{{query}}', activeQuery)}
          </p>
        )}

        {showResults && (
          <div className="space-y-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((task) => (
              <ResultRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
