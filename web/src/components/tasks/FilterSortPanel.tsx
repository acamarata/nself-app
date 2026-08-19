/**
 * FilterSortPanel.tsx — Filter + sort panel for todo list
 * Purpose: Provides filter (priority, status, tags) + sort controls.
 * Inputs: FilterState, SortState, onFilterChange, onSortChange, onClose
 * Outputs: Panel UI that updates URL params + calls callbacks.
 * Constraints: URL serialization via react-router useSearchParams, <300 lines.
 * SPORT: D2-S4
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import type { Priority } from '@/lib/graphql'

export interface FilterState {
  status: 'all' | 'active' | 'completed'
  priority: Priority | 'all'
  tagIds: string[]
}

export interface SortState {
  field: 'created_at' | 'due_date' | 'priority' | 'title'
  direction: 'asc' | 'desc'
}

const DEFAULT_FILTER: FilterState = { status: 'all', priority: 'all', tagIds: [] }
const DEFAULT_SORT: SortState = { field: 'created_at', direction: 'desc' }

interface FilterSortPanelProps {
  filter: FilterState
  sort: SortState
  onFilterChange: (f: FilterState) => void
  onSortChange: (s: SortState) => void
  onClose: () => void
}

const STATUS_OPTIONS: Array<{ value: FilterState['status']; labelKey: string }> = [
  { value: 'all', labelKey: 'filter.all' },
  { value: 'active', labelKey: 'filter.active' },
  { value: 'completed', labelKey: 'filter.completed' },
]

const PRIORITY_OPTIONS: Array<{ value: FilterState['priority']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const SORT_FIELDS: Array<{ value: SortState['field']; labelKey: string }> = [
  { value: 'created_at', labelKey: 'filter.sort.created' },
  { value: 'due_date', labelKey: 'filter.sort.due' },
  { value: 'priority', labelKey: 'filter.sort.priority' },
  { value: 'title', labelKey: 'filter.sort.title' },
]

function RadioGroup<T extends string>({
  name,
  options,
  value,
  onChange,
  t,
}: {
  name: string
  options: Array<{ value: T; label?: string; labelKey?: string }>
  value: T
  onChange: (v: T) => void
  t: (key: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const label = opt.label ?? (opt.labelKey ? t(opt.labelKey) : opt.value)
        const checked = value === opt.value
        return (
          <label
            key={opt.value}
            className={`
              cursor-pointer rounded-full px-3 py-1 text-xs font-medium border transition-colors
              ${checked
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {label}
          </label>
        )
      })}
    </div>
  )
}

export function FilterSortPanel({ filter, sort, onFilterChange, onSortChange, onClose }: FilterSortPanelProps) {
  const t = useT('tasks')
  const [, setSearchParams] = useSearchParams()

  function syncToUrl(f: FilterState, s: SortState) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('status', f.status)
      next.set('priority', f.priority)
      next.set('sort_field', s.field)
      next.set('sort_dir', s.direction)
      if (f.tagIds.length > 0) {
        next.set('tags', f.tagIds.join(','))
      } else {
        next.delete('tags')
      }
      return next
    })
  }

  function handleFilterChange(partial: Partial<FilterState>) {
    const next = { ...filter, ...partial }
    onFilterChange(next)
    syncToUrl(next, sort)
  }

  function handleSortChange(partial: Partial<SortState>) {
    const next = { ...sort, ...partial }
    onSortChange(next)
    syncToUrl(filter, next)
  }

  function handleClear() {
    onFilterChange(DEFAULT_FILTER)
    onSortChange(DEFAULT_SORT)
    syncToUrl(DEFAULT_FILTER, DEFAULT_SORT)
  }

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const isDirty =
    filter.status !== DEFAULT_FILTER.status ||
    filter.priority !== DEFAULT_FILTER.priority ||
    filter.tagIds.length > 0 ||
    sort.field !== DEFAULT_SORT.field ||
    sort.direction !== DEFAULT_SORT.direction

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/20 dark:bg-black/40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-label={t('filter.title')}
        className="fixed inset-y-0 right-0 z-40 w-72 bg-white dark:bg-gray-900 shadow-xl flex flex-col lg:relative lg:inset-auto lg:z-auto lg:w-auto lg:shadow-none lg:border-l lg:border-gray-200 lg:dark:border-gray-700"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('filter.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter panel"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <section>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Status
            </h3>
            <RadioGroup
              name="status"
              options={STATUS_OPTIONS}
              value={filter.status}
              onChange={(v) => handleFilterChange({ status: v })}
              t={t}
            />
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('filter.priority')}
            </h3>
            <RadioGroup
              name="priority"
              options={PRIORITY_OPTIONS}
              value={filter.priority}
              onChange={(v) => handleFilterChange({ priority: v as FilterState['priority'] })}
              t={t}
            />
          </section>

          <section>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('filter.sort.title')}
            </h3>
            <div className="space-y-2">
              <select
                value={sort.field}
                onChange={(e) => handleSortChange({ field: e.target.value as SortState['field'] })}
                aria-label={t('filter.sort.title')}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                ))}
              </select>
              <div className="flex gap-2">
                {(['asc', 'desc'] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => handleSortChange({ direction: dir })}
                    aria-pressed={sort.direction === dir}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sort.direction === dir
                        ? 'border-brand-primary bg-indigo-50 dark:bg-indigo-900/20 text-brand-primary'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {dir === 'asc' ? t('filter.sort.asc') : t('filter.sort.desc')}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {isDirty && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClear}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('filter.clearAll')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
