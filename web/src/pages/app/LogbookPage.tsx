/**
 * LogbookPage.tsx — /logbook — completed todos grouped by completion date
 *
 * Purpose:    Historical view of completed work across all lists, newest day
 *             first, with an "uncomplete" action to restore a task to active.
 * Inputs:     useAllTodos() — cross-list GraphQL data hook
 * Outputs:    Per-day grouped completed-todo list with uncomplete buttons
 * Constraints: ≤300 lines; loading/empty/error states; a11y landmarks
 * SPORT: view pages — Logbook.
 */
import { useMemo } from 'react'
import clsx from 'clsx'
import { useAllTodos } from '@/hooks/useAllTodos'
import { getLogbookGroups } from '@/lib/task-date-groups'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'
import type { NpTask } from '@/lib/graphql'

interface LogbookRowProps {
  todo: NpTask
  onUncomplete: (id: string) => void
}

function LogbookRow({ todo, onUncomplete }: LogbookRowProps) {
  const t = useT('tasks')
  return (
    <div className="group flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <span
        aria-hidden="true"
        className="flex-shrink-0 h-5 w-5 rounded-full bg-brand-primary border-2 border-indigo-600 flex items-center justify-center"
      >
        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className={clsx('flex-1 min-w-0 truncate text-sm line-through text-gray-400')}>{todo.title}</p>
      <button
        type="button"
        onClick={() => onUncomplete(todo.id)}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-sky-50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        {t('logbook.markIncomplete')}
      </button>
    </div>
  )
}

export function LogbookPage() {
  usePageMeta({ title: 'Logbook' })
  const t = useT('tasks')
  const { todos, loading, error, toggle } = useAllTodos()

  const groups = useMemo(() => getLogbookGroups(todos), [todos])
  const totalCompleted = groups.reduce((sum, g) => sum + g.todos.length, 0)

  function handleUncomplete(id: string) {
    void toggle(id, false)
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('logbook.title')}</h1>
        {!loading && (
          <span className="text-xs text-gray-400 tabular-nums">{t('logbook.completedCount').replace('{{count}}', String(totalCompleted))}</span>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <TodoSkeleton />
      ) : totalCompleted === 0 ? (
        <EmptyState
          icon="🗒️"
          title={t('logbook.emptyTitle')}
          description={t('logbook.emptyDescription')}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`logbook-${group.label}`}>
              <h2
                id={`logbook-${group.label}`}
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1"
              >
                {group.label} · {group.todos.length}
              </h2>
              <ul role="list" className="space-y-1">
                {group.todos.map((todo) => (
                  <li key={todo.id}>
                    <LogbookRow todo={todo} onUncomplete={handleUncomplete} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
