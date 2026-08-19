/**
 * SearchModal.tsx — Full-screen task search overlay (Cmd+K / search)
 * Purpose: Type-ahead search with keyboard navigation and recent searches.
 * Inputs:  onClose: () => void
 * Outputs: Modal with search input, results, recent searches, empty state.
 * Constraints: WCAG dialog. ≤300 lines.
 * SPORT: D2-S7-T2
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { SearchBar } from '@/components/tasks/SearchBar'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import type { NpTaskSummary, NpTask } from '@/lib/graphql'

const RECENT_KEY = 'ntask_recent_searches'
const MAX_RECENT = 5

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveRecent(query: string): void {
  const prev = loadRecent().filter((q) => q !== query)
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)))
}

interface Props {
  onClose: () => void
}

export function SearchModal({ onClose }: Props) {
  const t = useT('tasks')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NpTaskSummary[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [createPrefill, setCreatePrefill] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const items = results.slice(0, 5)
  const showRecent = query.trim().length < 2 && recent.length > 0
  const showEmpty = query.trim().length >= 2 && results.length === 0

  // Reset selection when results change
  useEffect(() => setSelectedIdx(0), [results])

  function handleResults(r: NpTaskSummary[]) {
    setResults(r)
  }

  function selectResult(task: NpTaskSummary) {
    if (query.trim().length >= 2) saveRecent(query.trim())
    setRecent(loadRecent())
    navigate(`/lists/${task.list_id}`)
    onClose()
  }

  function createFromQuery() {
    const trimmed = query.trim()
    if (!trimmed) return
    saveRecent(trimmed)
    setCreatePrefill(trimmed)
  }

  function handleTaskCreated(task: NpTask) {
    setCreatePrefill(null)
    onClose()
    if (task.list_id) navigate(`/lists/${task.list_id}`)
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const total = showRecent ? recent.length : items.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, total - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        if (showRecent && recent[selectedIdx]) {
          setQuery(recent[selectedIdx])
        } else if (items[selectedIdx]) {
          selectResult(items[selectedIdx])
        } else if (showEmpty) {
          createFromQuery()
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, recent, selectedIdx, showRecent, showEmpty, query]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh]"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        role="dialog"
        aria-label={t('search.modalLabel')}
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <SearchBar
            onResults={handleResults}
            initialQuery={query}
            onQueryChange={setQuery}
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {showRecent && (
            <section aria-label={t('search.recentSearches')}>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {t('search.recentSearches')}
              </p>
              <ul ref={listRef} role="listbox">
                {recent.map((q, i) => (
                  <li
                    key={q}
                    role="option"
                    aria-selected={i === selectedIdx}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                      i === selectedIdx
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setQuery(q)}
                  >
                    <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {q}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!showRecent && items.length > 0 && (
            <section aria-label={t('search.tasksSection')}>
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {t('search.tasksSection')}
              </p>
              <ul ref={listRef} role="listbox">
                {items.map((task, i) => (
                  <li
                    key={task.id}
                    role="option"
                    aria-selected={i === selectedIdx}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                      i === selectedIdx
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => selectResult(task)}
                  >
                    <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="truncate">{task.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showEmpty && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t('search.emptyHint').replace('{{query}}', query.trim())}
              </p>
              <button
                type="button"
                onClick={createFromQuery}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
              >
                {t('search.createFromQuery').replace('{{query}}', query.trim())}
              </button>
            </div>
          )}
        </div>
      </div>

      {createPrefill !== null && (
        <CreateTaskDialog
          prefillTitle={createPrefill}
          onCreated={handleTaskCreated}
          onClose={() => setCreatePrefill(null)}
        />
      )}
    </div>
  )
}
