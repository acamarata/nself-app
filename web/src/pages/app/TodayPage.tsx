/**
 * TodayPage.tsx — /today — cross-list todos due today + overdue
 *
 * Purpose:    Aggregate view across all lists: overdue todos surfaced first,
 *             then todos due today. Each item can be toggled complete.
 * Inputs:     useAllTodos() — cross-list GraphQL data hook
 * Outputs:    Grouped (Overdue / Today) todo list with counts
 * Constraints: ≤300 lines; loading/empty/error states; a11y landmarks
 * SPORT: view pages — Today.
 */
import { useMemo } from 'react'
import { useAllTodos } from '@/hooks/useAllTodos'
import { getOverdueTodos, getTodayTodos } from '@/lib/task-date-groups'
import { TodoItem } from '@/components/tasks/TodoItem'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

export function TodayPage() {
  usePageMeta({ title: 'Today' })
  const t = useT('tasks')
  const { todos, loading, error, toggle, remove } = useAllTodos()

  const overdue = useMemo(() => getOverdueTodos(todos), [todos])
  const today = useMemo(() => getTodayTodos(todos), [todos])
  const totalVisible = overdue.length + today.length

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('today.title')}</h1>
        {!loading && (
          <span className="text-xs text-gray-400 tabular-nums">{t('today.dueCount').replace('{{count}}', String(totalVisible))}</span>
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
          icon="☀️"
          title={t('today.emptyTitle')}
          description={t('today.emptyDescription')}
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section aria-labelledby="overdue-heading">
              <h2
                id="overdue-heading"
                className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-2 px-1"
              >
                {t('today.overdueHeading')} · {overdue.length}
              </h2>
              <ul role="list" className="space-y-1">
                {overdue.map((todo) => (
                  <li key={todo.id}>
                    <TodoItem todo={todo} onToggle={toggle} onDelete={remove} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {today.length > 0 && (
            <section aria-labelledby="today-heading">
              <h2
                id="today-heading"
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1"
              >
                {t('today.todayHeading')} · {today.length}
              </h2>
              <ul role="list" className="space-y-1">
                {today.map((todo) => (
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
