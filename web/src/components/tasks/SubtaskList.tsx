/**
 * SubtaskList.tsx — Subtask checklist for a todo item
 * Purpose: Display + manage subtasks (checklist) for np_todos.
 * Inputs: todoId (string), initially collapsed, expands on click.
 * Outputs: Subtask list with add input, toggle, delete, progress bar.
 * Constraints: Inline CRUD, optimistic toggle, <300 lines.
 * SPORT: D2-S2-T1
 */
import { useEffect, useRef, useState } from 'react'
import { useScreenState } from '@/hooks/useScreenState'
import { useT } from '@/lib/i18n'
import {
  getSubtasks,
  createSubtask,
  toggleSubtask,
  deleteSubtask,
} from '@/lib/graphql'
import type { NpSubtask } from '@/lib/graphql'

interface SubtaskListProps {
  todoId: string
}

export function SubtaskList({ todoId }: SubtaskListProps) {
  const t = useT('tasks')
  const [subtasks, setSubtasks] = useState<NpSubtask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const screen = useScreenState({ loading, data: subtasks, error })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getSubtasks(todoId)
      if (!cancelled) {
        setSubtasks(result)
        setLoading(false)
      }
    }
    if (expanded) load()
    return () => { cancelled = true }
  }, [todoId, expanded])

  const doneCount = subtasks.filter((s) => s.is_done).length
  const totalCount = subtasks.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  async function handleToggle(id: string, current: boolean) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_done: !current } : s))
    )
    const ok = await toggleSubtask(id, !current)
    if (!ok) {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_done: current } : s))
      )
    }
  }

  async function handleDelete(id: string) {
    const previous = subtasks
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
    const ok = await deleteSubtask(id)
    if (!ok) setSubtasks(previous)
  }

  async function handleAdd() {
    const title = newTitle.trim()
    if (!title) return
    setAdding(true)
    const result = await createSubtask({
      todo_id: todoId,
      title,
      position: subtasks.length,
    })
    if (result) {
      setSubtasks((prev) => [...prev, result])
      setNewTitle('')
      inputRef.current?.focus()
    }
    setAdding(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-expanded={expanded}
      >
        <svg
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t('subtasks.title')}</span>
        {totalCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {doneCount}/{totalCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
                role="progressbar"
                aria-valuenow={doneCount}
                aria-valuemax={totalCount}
                aria-label={t('subtasks.progress').replace('{{done}}', String(doneCount)).replace('{{total}}', String(totalCount))}
              >
                <div
                  className="h-full rounded-full bg-brand-primary transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                {progressPct}%
              </span>
            </div>
          )}

          {screen.isLoading && (
            <div className="py-2 text-sm text-gray-400 dark:text-gray-500 animate-pulse">
              {t('states.loading')}
            </div>
          )}

          {screen.isError && !screen.isLoading && (
            <p className="text-sm text-red-500">{t('states.error')}</p>
          )}

          {!screen.isLoading && screen.isEmpty && (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-1">
              {t('subtasks.empty')}
            </p>
          )}

          {!screen.isLoading && subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <input
                type="checkbox"
                checked={subtask.is_done}
                onChange={() => handleToggle(subtask.id, subtask.is_done)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-primary focus:ring-brand-primary cursor-pointer"
                aria-label={`${subtask.is_done ? 'Mark incomplete' : 'Mark complete'}: ${subtask.title}`}
              />
              <span
                className={`flex-1 text-sm ${
                  subtask.is_done
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(subtask.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all"
                aria-label={`Delete subtask: ${subtask.title}`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4H5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 mt-1">
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('subtasks.placeholder')}
              disabled={adding}
              aria-label={t('subtasks.add')}
              className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newTitle.trim()}
              aria-label={t('subtasks.add')}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
