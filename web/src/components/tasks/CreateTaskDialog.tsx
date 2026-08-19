/**
 * CreateTaskDialog.tsx — Modal dialog for creating a new task
 * Purpose: Collect title, notes, priority, due date, list; call createTodo(); invoke callback.
 * Inputs: listId (optional), prefillTitle (optional), onCreated, onClose callbacks.
 * Outputs: NpTask via onCreated on success; modal closed on Escape or cancel.
 * Constraints: role=dialog; Enter submits, Escape closes; <300 lines.
 * SPORT: D2-S7-T1
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { createTodo, getLists } from '@/lib/graphql'
import type { NpTask, NpList } from '@/lib/graphql'
import type { Priority } from '@/lib/graphql'
import { combineDueDateTime } from '@/lib/due-date'

interface CreateTaskDialogProps {
  listId?: string
  prefillTitle?: string
  onCreated: (todo: NpTask) => void
  onClose: () => void
}

const PRIORITIES: Array<{ value: Priority | ''; label: string; key: string }> = [
  { value: '', label: 'createTask.priorityNone', key: 'none' },
  { value: 'low', label: 'createTask.priorityLow', key: 'low' },
  { value: 'medium', label: 'createTask.priorityMedium', key: 'medium' },
  { value: 'high', label: 'createTask.priorityHigh', key: 'high' },
  { value: 'urgent', label: 'createTask.priorityUrgent', key: 'urgent' },
]

export function CreateTaskDialog({ listId, prefillTitle = '', onCreated, onClose }: CreateTaskDialogProps) {
  const t = useT('tasks')
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(prefillTitle)
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [selectedListId, setSelectedListId] = useState(listId ?? '')
  const [lists, setLists] = useState<NpList[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load lists only when no listId provided
  useEffect(() => {
    if (listId) return
    let cancelled = false
    getLists().then((result) => {
      if (!cancelled) {
        setLists(result)
        if (result.length > 0 && !selectedListId) {
          setSelectedListId(result[0]?.id ?? '')
        }
      }
    })
    return () => { cancelled = true }
  }, [listId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autofocus title; Escape closes
  useEffect(() => {
    titleRef.current?.focus()
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    setSubmitting(true)

    const effectiveListId = selectedListId || listId || ''
    const result = await createTodo({
      title: trimmed,
      notes: notes.trim() || undefined,
      priority: priority || undefined,
      due_date: combineDueDateTime(dueDate, dueTime),
      list_id: effectiveListId,
    })

    setSubmitting(false)
    if (!result) {
      setError(t('states.error'))
      return
    }
    onCreated(result)
    onClose()
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-label={t('createTask.dialog')}
        aria-modal="true"
        className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl outline-none"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('createTask.heading')}
            </h2>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* Title */}
            <div>
              <label
                htmlFor="create-task-title"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
              >
                {t('createTask.title')}
              </label>
              <input
                id="create-task-title"
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                required
                aria-required="true"
                placeholder={t('createTask.titlePlaceholder')}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="create-task-notes"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
              >
                {t('createTask.notes')}
              </label>
              <textarea
                id="create-task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t('createTask.notesPlaceholder')}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Priority */}
              <div>
                <label
                  htmlFor="create-task-priority"
                  className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                >
                  {t('createTask.priority')}
                </label>
                <select
                  id="create-task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority | '')}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.key} value={p.value}>{t(p.label)}</option>
                  ))}
                </select>
              </div>

              {/* Due date + time */}
              <div>
                <label
                  htmlFor="create-task-due"
                  className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                >
                  {t('createTask.dueDate')}
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="create-task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                  <input
                    id="create-task-due-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    disabled={!dueDate}
                    aria-label={t('createTask.dueTime')}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* List selector — only shown when no listId prop */}
            {!listId && lists.length > 0 && (
              <div>
                <label
                  htmlFor="create-task-list"
                  className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                >
                  {t('filter.list')}
                </label>
                <select
                  id="create-task-list"
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs text-red-500">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('createTask.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {t('createTask.create')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
