/**
 * TodoItem.tsx — Individual todo item row
 *
 * Purpose: Render a single task with toggle, delete, priority badge, and
 *   locale-aware due-date display. Arabic locale shows Hijri calendar dates
 *   via formatHijriDate from @nself/i18n.
 * Inputs: todo (Todo), onToggle, onDelete callbacks
 * Outputs: Accessible todo row with check, title, due date, priority badge
 * Constraints:
 *   - Hijri date uses Intl.DateTimeFormat calendar:'islamic-umalqura' (no lib)
 *   - Locale is read from document.documentElement.lang (set in main.tsx)
 *   - RTL layout is handled by CSS dir attribute; no conditional rendering
 * SPORT: T-P3-E6-W1-S3-T01 — RTL + Hijri date utilities (ntask)
 */
import { useState } from 'react'
import clsx from 'clsx'
import { formatHijriDate, formatLocaleDate } from '@nself/i18n'
import type { NpTaskSummary, Priority } from '@/lib/graphql'
import { formatDueTime } from '@/lib/due-date'
import { useT } from '@/lib/i18n'
import { SnoozeMenu } from './SnoozeMenu'

const PRIORITY_COLORS: Record<Priority, string> = {
  none: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  low: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  medium: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  high: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

interface TodoItemProps {
  todo: NpTaskSummary
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Multi-select mode (bulk actions). When true, shows a selection checkbox instead of complete toggle on hover. */
  selectable?: boolean
  selected?: boolean
  onSelectToggle?: (id: string) => void
  /** Called with the task id + new ISO due date when the row's snooze menu is used. */
  onSnooze?: (id: string, nextDueDate: string) => Promise<void> | void
  /** Opens TaskDetailPanel for this task. Row title acts as the click target. */
  onOpenDetail?: (id: string) => void
}

/**
 * Format a due date for display, respecting the active locale.
 * Arabic locale shows a Hijri calendar date (islamic-umalqura).
 * All other locales use the Gregorian calendar with the locale's number system.
 *
 * @param dateStr — ISO date string or null
 * @param locale  — BCP47 locale code (default: read from html[lang])
 * @returns Formatted date label or null if dateStr is falsy
 */
function formatDueDate(dateStr: string | null, locale: string): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const isOverdue = d < new Date()

  // Arabic locale: display Hijri date using short format
  const label =
    locale === 'ar' || locale.startsWith('ar-')
      ? formatHijriDate(d, 'ar-SA', { dateStyle: 'medium' })
      : formatLocaleDate(d, locale, { month: 'short', day: 'numeric' })

  return isOverdue ? `${label} ·` : label
}

export function TodoItem({ todo, onToggle, onDelete, selectable, selected, onSelectToggle, onSnooze, onOpenDetail }: TodoItemProps) {
  const t = useT('tasks')
  const [loading, setLoading] = useState(false)
  // Read locale from the HTML root element (set eagerly in main.tsx)
  const locale = document.documentElement.lang || 'en'

  async function handleToggle() {
    setLoading(true)
    await onToggle(todo.id, !todo.completed)
    setLoading(false)
  }

  async function handleDelete() {
    setLoading(true)
    await onDelete(todo.id)
    setLoading(false)
  }

  const dueLabel = formatDueDate(todo.due_date, locale)
  const dueTimeLabel = formatDueTime(todo.due_date, locale)
  const isOverdue = todo.due_date && new Date(todo.due_date) < new Date() && !todo.completed

  return (
    <div
      className={clsx(
        'group flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        selectable && selected && 'bg-indigo-50 dark:bg-indigo-900/20'
      )}
    >
      {selectable ? (
        <button
          onClick={() => onSelectToggle?.(todo.id)}
          className={clsx(
            'flex-shrink-0 h-5 w-5 rounded-md border-2 transition-colors flex items-center justify-center',
            selected
              ? 'bg-brand-primary border-indigo-600'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
          )}
          role="checkbox"
          aria-checked={!!selected}
          aria-label={`${t('todoItem.selectTask')}: ${todo.title}`}
        >
          {selected && (
            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <button
          onClick={handleToggle}
          disabled={loading}
          className={clsx(
            'flex-shrink-0 h-5 w-5 rounded-full border-2 transition-colors flex items-center justify-center',
            todo.completed
              ? 'bg-brand-primary border-indigo-600'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
          )}
          aria-label={todo.completed ? t('todoItem.markIncomplete') : t('todoItem.markComplete')}
        >
          {todo.completed && (
            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      <div
        className={clsx('flex-1 min-w-0', !selectable && onOpenDetail && 'cursor-pointer')}
        onClick={!selectable ? () => onOpenDetail?.(todo.id) : undefined}
      >
        <p className={clsx('text-sm truncate', todo.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white')}>
          {todo.title}
        </p>
        {(dueLabel || todo.priority !== 'none') && (
          <div className="flex items-center gap-2 mt-0.5 rtl:flex-row-reverse">
            {dueLabel && (
              <span className={clsx('text-xs', isOverdue ? 'text-red-500' : 'text-gray-400')}>
                {dueLabel}
                {dueTimeLabel && ` · ${dueTimeLabel}`}
              </span>
            )}
            {todo.priority !== 'none' && (
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[todo.priority])}>
                {todo.priority}
              </span>
            )}
          </div>
        )}
      </div>

      {!selectable && (
        <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-all">
          {onSnooze && (
            <SnoozeMenu dueDate={todo.due_date} onSnooze={(next) => onSnooze(todo.id, next)} />
          )}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label={`${t('todoItem.deleteTask')}: ${todo.title}`}
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4H5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
