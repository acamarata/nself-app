/**
 * BoardColumn.tsx — Single droppable column for the Kanban board
 *
 * Purpose:    Renders one priority (or Done) column as a @dnd-kit droppable
 *             zone containing sortable task cards.
 * Inputs:     id (column id), title, todos, accent color
 * Outputs:    Column header + count + sortable card list
 * Constraints: ≤150 lines; keyboard accessible via dnd-kit KeyboardSensor.
 * SPORT: view pages — Board.
 */
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import clsx from 'clsx'
import { BoardCard } from './BoardCard'
import type { NpTask } from '@/lib/graphql'

interface BoardColumnProps {
  id: string
  title: string
  accentClass: string
  todos: NpTask[]
}

export function BoardColumn({ id, title, accentClass, todos }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className={clsx('h-2.5 w-2.5 rounded-full', accentClass)} aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span className="ml-auto text-xs text-gray-400 tabular-nums">{todos.length}</span>
      </div>

      <div
        ref={setNodeRef}
        role="list"
        aria-label={`${title} column`}
        className={clsx(
          'flex-1 min-h-[8rem] rounded-xl p-2 space-y-2 transition-colors',
          isOver ? 'bg-sky-50 dark:bg-indigo-900/20' : 'bg-gray-50 dark:bg-gray-900/40',
        )}
      >
        <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {todos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No tasks</p>
          ) : (
            todos.map((todo) => <BoardCard key={todo.id} todo={todo} />)
          )}
        </SortableContext>
      </div>
    </div>
  )
}
