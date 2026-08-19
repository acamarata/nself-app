/**
 * BoardPage.tsx — /board — Kanban board, priority columns + Done
 *
 * Purpose:    np_todos has no status column (only `completed` bool + `priority`),
 *             so columns are priority-based (Low/Medium/High/Urgent) plus a
 *             trailing Done column driven by `completed`. Dragging a card
 *             between priority columns updates priority; dropping on Done
 *             marks it completed (and clears completed when dragged back out).
 *             A list filter <select> acts as the "per-list board toggle".
 * Inputs:     useAllTodos() — cross-list GraphQL data hook
 * Outputs:    Horizontal scrollable column board with drag-and-drop
 * Constraints: ≤300 lines; @dnd-kit/core + sortable (already a dep); a11y via
 *              dnd-kit keyboard sensor + aria-label columns.
 * SPORT: view pages — Board.
 */
import { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useAllTodos } from '@/hooks/useAllTodos'
import { BoardColumn } from '@/components/tasks/BoardColumn'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'
import type { NpTask, Priority } from '@/lib/graphql'

type ColumnId = Priority | 'done'

const COLUMN_META: { id: ColumnId; titleKey: string; accentClass: string }[] = [
  { id: 'none', titleKey: 'createTask.priorityNone', accentClass: 'bg-gray-300 dark:bg-gray-600' },
  { id: 'low', titleKey: 'createTask.priorityLow', accentClass: 'bg-blue-400' },
  { id: 'medium', titleKey: 'createTask.priorityMedium', accentClass: 'bg-yellow-400' },
  { id: 'high', titleKey: 'createTask.priorityHigh', accentClass: 'bg-orange-400' },
  { id: 'urgent', titleKey: 'createTask.priorityUrgent', accentClass: 'bg-red-400' },
  { id: 'done', titleKey: 'board.columnDone', accentClass: 'bg-green-500' },
]

function columnFor(todo: NpTask): ColumnId {
  return todo.completed ? 'done' : todo.priority
}

export function BoardPage() {
  usePageMeta({ title: 'Board' })
  const t = useT('tasks')
  const { todos, lists, loading, error, toggle, setPriority } = useAllTodos()
  const [listFilter, setListFilter] = useState<string>('all')
  const COLUMNS = useMemo(
    () => COLUMN_META.map((c) => ({ id: c.id, title: t(c.titleKey), accentClass: c.accentClass })),
    [t],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const filtered = useMemo(
    () => (listFilter === 'all' ? todos : todos.filter((t) => t.list_id === listFilter)),
    [todos, listFilter],
  )

  const columns = useMemo(() => {
    const byColumn = new Map<ColumnId, NpTask[]>(COLUMNS.map((c) => [c.id, []]))
    for (const todo of filtered) {
      byColumn.get(columnFor(todo))?.push(todo)
    }
    return COLUMNS.map((c) => ({ ...c, todos: byColumn.get(c.id) ?? [] }))
  }, [filtered, COLUMNS])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const todo = filtered.find((t) => t.id === active.id)
    if (!todo) return

    // `over.id` is either a column id (dropped on empty column area) or
    // another card's id (dropped between/on cards) — resolve to its column.
    const overColumn: ColumnId | undefined =
      (COLUMNS.find((c) => c.id === over.id)?.id) ??
      columnFor(filtered.find((t) => t.id === over.id) as NpTask)

    if (!overColumn || overColumn === columnFor(todo)) return

    if (overColumn === 'done') {
      await toggle(todo.id, true)
    } else {
      if (todo.completed) await toggle(todo.id, false)
      await setPriority(todo.id, overColumn)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('board.title')}</h1>
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {t('board.listLabel')}
          <select
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">{t('board.allLists')}</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="mb-4 max-w-5xl mx-auto rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="max-w-5xl mx-auto">
          <TodoSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🗂️" title={t('board.emptyTitle')} description={t('board.emptyDescription')} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {columns.map((col) => (
              <BoardColumn key={col.id} id={col.id} title={col.title} accentClass={col.accentClass} todos={col.todos} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}
