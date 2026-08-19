/**
 * ListCard.tsx — Task list summary card component
 *
 * Purpose:    Displays a single task list as a clickable card showing the list
 *             name, color badge, task count, and completion percentage.
 * Inputs:     list: TaskList (from GraphQL), onDelete?: () => void
 * Outputs:    Card link to /lists/:id with task progress indicator
 * Constraints: Click on delete button must not navigate to list (stopPropagation)
 */
import { Link } from 'react-router-dom'
import type { NpList } from '@/lib/graphql'
import { ListIcon } from './ListIcon'

interface ListCardProps {
  list: NpList
  todoCount?: number
}

export function ListCard({ list, todoCount }: ListCardProps) {
  const color = list.color || '#6366f1'

  return (
    <Link
      to={`/lists/${list.id}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm transition-all group"
    >
      <div
        className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg font-medium"
        style={{ backgroundColor: color }}
      >
        <ListIcon icon={list.icon} title={list.title} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{list.title}</p>
        {list.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{list.description}</p>
        )}
      </div>
      {todoCount !== undefined && (
        <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {todoCount}
        </span>
      )}
      <svg className="flex-shrink-0 h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}
