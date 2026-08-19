/**
 * TaskDetailPanel.tsx — Slide-in right panel for task detail view
 * Purpose: Full task detail: editable title, notes, due date+time, reminders,
 *          tags, assignees, subtasks, comments, attachments, recurrence, snooze.
 * Inputs: todoId, onClose callback.
 * Outputs: Rendered panel; inline title/notes/due-date edits via updateTodo; dialog semantics.
 * Constraints: role="dialog"/aria-modal/aria-labelledby + real focus trap + Escape
 *              + focus restore via the shared useFocusTrap hook
 *              (src/hooks/useFocusTrap.ts); fixed right panel desktop,
 *              full-screen mobile; <300 lines (feature sub-sections extracted
 *              into their own components to stay under budget).
 * SPORT: D2-S7-T1
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { getTodo, updateTodo, getTodoTagIds, getRecurringRules } from '@/lib/graphql'
import type { NpTask } from '@/lib/graphql'
import { SubtaskList } from './SubtaskList'
import { CommentThread } from './CommentThread'
import { RecurrenceSelector } from './RecurrenceSelector'
import { AttachmentDropzone } from './AttachmentDropzone'
import { AttachmentList } from './AttachmentList'
import type { NpAttachment } from '@/lib/graphql-attachments'
import type { NpRecurringRule } from '@/lib/graphql'
import { TaskDueDateEditor } from './TaskDueDateEditor'
import { ReminderList } from './ReminderList'
import { TaskTagPicker } from './TaskTagPicker'
import { AssigneeSelector } from './AssigneeSelector'
import { NotesEditor } from './NotesEditor'
import { SnoozeMenu } from './SnoozeMenu'

interface TaskDetailPanelProps {
  todoId: string
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AttachmentSection({ todoId }: { todoId: string }) {
  const [newItems, setNewItems] = useState<NpAttachment[]>([])

  function handleUploaded(attachment: NpAttachment) {
    setNewItems((prev) => [...prev, attachment])
  }

  return (
    <div>
      <AttachmentList todoId={todoId} newItems={newItems} />
      <AttachmentDropzone todoId={todoId} onUploaded={handleUploaded} />
    </div>
  )
}

export function TaskDetailPanel({ todoId, onClose }: TaskDetailPanelProps) {
  const t = useT('tasks')
  const [task, setTask] = useState<NpTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [recurringRule, setRecurringRule] = useState<NpRecurringRule | null>(null)
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [result, tagResult, recurringRules] = await Promise.all([
        getTodo(todoId),
        getTodoTagIds(todoId),
        getRecurringRules(todoId),
      ])
      if (!cancelled) {
        setTask(result)
        setTitleDraft(result?.title ?? '')
        setTagIds(tagResult)
        setRecurringRule(recurringRules[0] ?? null)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [todoId])

  // Real focus trap (Tab/Shift+Tab cycling), Escape close, and focus restore
  // on unmount — shared with NewListModal/ShareListDialog via useFocusTrap.
  useFocusTrap(panelRef, onClose)

  function startEditTitle() {
    setEditingTitle(true)
    requestAnimationFrame(() => titleInputRef.current?.select())
  }

  async function saveTitle() {
    setEditingTitle(false)
    const title = titleDraft.trim()
    if (!title || title === task?.title) return
    setSavingTitle(true)
    const updated = await updateTodo(todoId, { title })
    if (updated) setTask(updated)
    setSavingTitle(false)
  }

  async function saveNotes(nextNotes: string) {
    if (nextNotes === (task?.notes ?? '')) return
    setSavingNotes(true)
    const updated = await updateTodo(todoId, { notes: nextNotes })
    if (updated) setTask(updated)
    setSavingNotes(false)
  }

  async function saveDueDate(nextDueDate: string | null) {
    const updated = await updateTodo(todoId, { due_date: nextDueDate })
    if (updated) setTask(updated)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
    if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(task?.title ?? '') }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30 lg:hidden"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="task-detail-panel-title"
        aria-modal="true"
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-40 flex flex-col w-full lg:w-96 bg-white dark:bg-gray-900 shadow-xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <span id="task-detail-panel-title" className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('taskDetail.detail')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('taskDetail.close')}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && (
            <p className="text-sm text-gray-400 animate-pulse">{t('states.loading')}</p>
          )}

          {!loading && task && (
            <>
              {/* Title */}
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={handleTitleKeyDown}
                      disabled={savingTitle}
                      aria-label={t('createTask.title')}
                      className="w-full rounded-lg border border-indigo-400 bg-white dark:bg-gray-800 px-3 py-2 text-base font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={startEditTitle}
                      aria-label={`${t('taskDetail.editTitle')}: ${task.title}`}
                      className="w-full text-left rounded-lg px-3 py-2 text-base font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      {task.title}
                    </button>
                  )}
                </div>
                <SnoozeMenu dueDate={task.due_date} onSnooze={saveDueDate} />
              </div>

              <TaskDueDateEditor dueDate={task.due_date} onChange={saveDueDate} />

              <NotesEditor value={task.notes} onSave={saveNotes} disabled={savingNotes} />

              <TaskTagPicker todoId={todoId} todoTagIds={tagIds} onTagsChanged={setTagIds} />

              <AssigneeSelector todoId={todoId} listId={task.list_id} />

              <ReminderList todoId={todoId} dueDate={task.due_date} />

              <SubtaskList todoId={todoId} />
              <CommentThread todoId={todoId} />
              <AttachmentSection todoId={todoId} />
              <RecurrenceSelector
                todoId={todoId}
                rule={recurringRule}
                onChange={setRecurringRule}
              />
            </>
          )}

          {!loading && !task && (
            <p className="text-sm text-red-500">{t('states.error')}</p>
          )}
        </div>
      </div>
    </>
  )
}
