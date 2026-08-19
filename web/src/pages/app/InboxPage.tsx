/**
 * InboxPage.tsx — /inbox — untriaged todos (no list, or default list)
 *
 * Purpose:    Surface todos that haven't been filed into a real list yet, with
 *             a one-click "move to list" action per row for quick triage.
 * Inputs:     useAllTodos() — cross-list GraphQL data hook
 * Outputs:    Flat todo list with inline list-picker per row
 * Constraints: ≤300 lines; loading/empty/error states; a11y landmarks
 * SPORT: view pages — Inbox.
 */
import { useMemo } from 'react'
import { useAllTodos } from '@/hooks/useAllTodos'
import { getInboxTodos } from '@/lib/task-date-groups'
import { InboxRow } from '@/components/tasks/InboxRow'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'

export function InboxPage() {
  usePageMeta({ title: 'Inbox' })
  const t = useT('tasks')
  const { todos, lists, loading, error, toggle, remove, moveToList } = useAllTodos()

  const defaultList = useMemo(() => lists.find((l) => l.is_default) ?? null, [lists])
  const inboxTodos = useMemo(
    () => getInboxTodos(todos.filter((t) => !t.completed), defaultList?.id ?? null),
    [todos, defaultList],
  )
  // Only offer non-default, non-inbox-source lists as triage targets.
  const targetLists = useMemo(
    () => lists.filter((l) => l.id !== defaultList?.id),
    [lists, defaultList],
  )

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('inbox.title')}</h1>
        {!loading && (
          <span className="text-xs text-gray-400 tabular-nums">{t('inbox.untriagedCount').replace('{{count}}', String(inboxTodos.length))}</span>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <TodoSkeleton />
      ) : inboxTodos.length === 0 ? (
        <EmptyState
          icon="📥"
          title={t('inbox.emptyTitle')}
          description={t('inbox.emptyDescription')}
        />
      ) : (
        <ul role="list" className="space-y-1">
          {inboxTodos.map((todo) => (
            <li key={todo.id}>
              <InboxRow
                todo={todo}
                lists={targetLists}
                onToggle={toggle}
                onDelete={remove}
                onMove={moveToList}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
