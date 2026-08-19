/**
 * BoardCard.tsx — Sortable Kanban card for a single task
 *
 * Purpose:    Compact draggable card used inside BoardColumn. Pointer drag +
 *             keyboard (Space to grab, arrows to move, Space to drop) via
 *             @dnd-kit/sortable useSortable.
 * Inputs:     todo (NpTask)
 * Outputs:    Card with title + due date; drag handle covers whole card
 * Constraints: ≤80 lines.
 * SPORT: view pages — Board.
 */
import clsx from 'clsx'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import type { NpTask } from '@/lib/graphql'

interface BoardCardProps {
  todo: NpTask
}

export function BoardCard({ todo }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      tabIndex={0}
      aria-roledescription="sortable task card"
      className="rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700/50 px-3 py-2 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      <p className={clsx('text-sm truncate', todo.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white')}>
        {todo.title}
      </p>
      {todo.due_date && (
        <p className="mt-1 text-xs text-gray-400">{format(new Date(todo.due_date), 'MMM d')}</p>
      )}
    </div>
  )
}
