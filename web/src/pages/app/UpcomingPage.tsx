/**
 * UpcomingPage.tsx — /upcoming — next 7 days grouped by day + later
 *
 * Purpose:    Aggregate view across all lists: todos due in the next 7 days,
 *             grouped per-day, plus an open-ended "Later" bucket.
 * Inputs:     useAllTodos() — cross-list GraphQL data hook
 * Outputs:    Per-day grouped todo lists + Later section
 * Constraints: ≤300 lines; loading/empty/error states; a11y landmarks
 * SPORT: view pages — Upcoming.
 */
import { useMemo } from 'react'
import { useAllTodos } from '@/hooks/useAllTodos'
import { getUpcomingByDay, getLaterTodos } from '@/lib/task-date-groups'
import { TodoItem } from '@/components/tasks/TodoItem'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

const WINDOW_DAYS = 7

export function UpcomingPage() {
  usePageMeta({ title: 'Upcoming' })
  const t = useT('tasks')
  const { todos, loading, error, toggle, remove } = useAllTodos()

  const dayGroups = useMemo(() => getUpcomingByDay(todos, WINDOW_DAYS), [todos])
  const later = useMemo(() => getLaterTodos(todos, WINDOW_DAYS), [todos])

  const nonEmptyDayGroups = dayGroups.filter((g) => g.todos.length > 0)
  const totalVisible = nonEmptyDayGroups.reduce((sum, g) => sum + g.todos.length, 0) + later.length

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('upcoming.title')}</h1>
        {!loading && (
          <span className="text-xs text-gray-400 tabular-nums">{t('upcoming.scheduledCount').replace('{{count}}', String(totalVisible))}</span>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <TodoSkeleton />
      ) : totalVisible === 0 ? (
        <EmptyState
          icon="📅"
          title={t('upcoming.emptyTitle')}
          description={t('upcoming.emptyDescription')}
        />
      ) : (
        <div className="space-y-6">
          {nonEmptyDayGroups.map((group) => (
            <section key={group.label} aria-labelledby={`day-${group.label}`}>
              <h2
                id={`day-${group.label}`}
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1"
              >
                {group.label} · {group.todos.length}
              </h2>
              <ul role="list" className="space-y-1">
                {group.todos.map((todo) => (
                  <li key={todo.id}>
                    <TodoItem todo={todo} onToggle={toggle} onDelete={remove} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {later.length > 0 && (
            <section aria-labelledby="later-heading">
              <h2
                id="later-heading"
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1"
              >
                {t('upcoming.laterHeading')} · {later.length}
              </h2>
              <ul role="list" className="space-y-1">
                {later.map((todo) => (
                  <li key={todo.id}>
                    <TodoItem todo={todo} onToggle={toggle} onDelete={remove} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
