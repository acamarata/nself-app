/**
 * InboxRow.tsx — Inbox todo row with quick "move to list" triage control
 *
 * Purpose:    Wraps TodoItem with an inline list-picker so untriaged todos
 *             (no list, or in the default list) can be filed in one click.
 * Inputs:     todo, lists (candidate targets), onToggle, onDelete, onMove
 * Outputs:    TodoItem row + trailing <select> for list assignment
 * Constraints: Keyboard accessible native <select>; ≤80 lines.
 * SPORT: view pages — Inbox.
 */
import { useState } from 'react'
import type { NpTask, NpList } from '@/lib/graphql'
import { useT } from '@/lib/i18n'
import { TodoItem } from './TodoItem'

interface InboxRowProps {
  todo: NpTask
  lists: NpList[]
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMove: (id: string, listId: string) => Promise<void>
}

export function InboxRow({ todo, lists, onToggle, onDelete, onMove }: InboxRowProps) {
  const t = useT('tasks')
  const [moving, setMoving] = useState(false)

  async function handleMove(e: React.ChangeEvent<HTMLSelectElement>) {
    const listId = e.target.value
    if (!listId) return
    setMoving(true)
    await onMove(todo.id, listId)
    setMoving(false)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <TodoItem todo={todo} onToggle={onToggle} onDelete={onDelete} />
      </div>
      <label className="sr-only" htmlFor={`move-${todo.id}`}>
        {t('inbox.moveTaskToList').replace('{{title}}', todo.title)}
      </label>
      <select
        id={`move-${todo.id}`}
        value=""
        disabled={moving || lists.length === 0}
        onChange={handleMove}
        className="flex-shrink-0 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
      >
        <option value="" disabled>
          {t('inbox.moveTo')}
        </option>
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.title}
          </option>
        ))}
      </select>
    </div>
  )
}
