/**
 * SavedViewsList.tsx — Sidebar section for saved filter/sort views
 * Purpose: Display, apply, and delete user-saved filter views in the sidebar.
 *          Applying a view stores it in localStorage and dispatches a custom
 *          event so any mounted task list can react.
 * Inputs:  None (reads userId from useAuth())
 * Outputs: Sidebar section; hides itself when no saved views exist.
 * Constraints: WCAG list. i18n via useT('tasks'). ≤200 lines.
 * SPORT: D2-S7-T3
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { getSavedViews, deleteSavedView, type NpSavedView, type FilterParams } from '@/lib/graphql-saved-views'

export type { NpSavedView }

const ACTIVE_VIEW_KEY = 'ntask_active_saved_view'
const APPLY_EVENT = 'ntask:saved-view-apply'

function buildFilterSummary(filterParams: FilterParams): string {
  const parts: string[] = []
  if (filterParams.status && filterParams.status !== 'all') parts.push(filterParams.status)
  if (filterParams.priority) parts.push(filterParams.priority)
  return parts.join(' · ')
}

export function SavedViewsList() {
  const t = useT('tasks')
  const [views, setViews] = useState<NpSavedView[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    void getSavedViews().then(setViews)
  }, [])

  if (views.length === 0) return null

  function applyView(view: NpSavedView) {
    localStorage.setItem(ACTIVE_VIEW_KEY, JSON.stringify(view))
    window.dispatchEvent(
      new CustomEvent(APPLY_EVENT, { detail: { view } })
    )
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const ok = await deleteSavedView(id)
      if (ok) setViews((prev) => prev.filter((v) => v.id !== id))
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  return (
    <section aria-label={t('savedViews.title')} className="px-3 pb-3">
      <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {t('savedViews.title')}
      </p>

      <ul className="space-y-0.5" role="list">
        {views.map((view) => {
          const summary = buildFilterSummary(view.filters)
          const isConfirming = confirmDelete === view.id
          const isDeleting = deleting === view.id

          return (
            <li key={view.id} className="group relative flex items-center">
              <button
                type="button"
                className="flex-1 flex flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => applyView(view)}
              >
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[150px]">
                  {view.name}
                </span>
                {summary && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[150px]">
                    {summary}
                  </span>
                )}
              </button>

              {/* Delete button — visible on hover */}
              {!isConfirming ? (
                <button
                  type="button"
                  aria-label={t('savedViews.delete')}
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(view.id) }}
                  className="absolute right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <div className="absolute right-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleDelete(view.id)}
                    disabled={isDeleting}
                    aria-label={t('savedViews.confirmDelete')}
                    className="rounded px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? '…' : t('savedViews.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    aria-label={t('savedViews.cancelDelete')}
                    className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
