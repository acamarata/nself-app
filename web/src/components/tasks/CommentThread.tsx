/**
 * CommentThread.tsx — Comment thread for a todo item
 * Purpose: Display and manage comments on np_todos.
 * Inputs: todoId (string)
 * Outputs: Threaded comment list with add form, soft-delete, basic edit.
 * Constraints: No nested replies in UI (flat display), <300 lines.
 * SPORT: D2-S2-T2
 */
import { useEffect, useRef, useState } from 'react'
import { useScreenState } from '@/hooks/useScreenState'
import { useT } from '@/lib/i18n'
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '@/lib/graphql'
import type { NpComment } from '@/lib/graphql'

interface CommentThreadProps {
  todoId: string
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(document.documentElement.lang || 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AvatarInitial({ userId }: { userId: string }) {
  const initial = (userId || '?')[0].toUpperCase()
  return (
    <div
      className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-brand-primary dark:text-indigo-300 shrink-0"
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

export function CommentThread({ todoId }: CommentThreadProps) {
  const t = useT('tasks')
  const [comments, setComments] = useState<NpComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const visible = comments.filter((c) => !c.deleted_at)
  const screen = useScreenState({ loading, data: visible, error })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getComments(todoId)
      if (!cancelled) {
        setComments(result)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [todoId])

  async function handleSubmit() {
    const body = newBody.trim()
    if (!body) return
    setSubmitting(true)
    const result = await createComment({
      todo_id: todoId,
      body,
      idempotency_key: crypto.randomUUID(),
    })
    if (result) {
      setComments((prev) => [...prev, result])
      setNewBody('')
    }
    setSubmitting(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  async function handleDelete(id: string) {
    const prev = comments
    setComments((c) => c.map((x) => x.id === id ? { ...x, deleted_at: new Date().toISOString() } : x))
    const ok = await deleteComment(id)
    if (!ok) setComments(prev)
  }

  function startEdit(comment: NpComment) {
    setEditingId(comment.id)
    setEditBody(comment.body)
  }

  async function handleEditSave(id: string) {
    const body = editBody.trim()
    if (!body) return
    const prev = comments
    setComments((c) => c.map((x) => x.id === id ? { ...x, body } : x))
    setEditingId(null)
    const result = await updateComment(id, { body })
    if (!result) setComments(prev)
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSave(id)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {t('comments.title')}
        {visible.length > 0 && (
          <span className="ml-1.5 text-xs text-gray-400">({visible.length})</span>
        )}
      </h3>

      {screen.isLoading && (
        <p className="text-sm text-gray-400 animate-pulse">{t('states.loading')}</p>
      )}

      {screen.isError && !screen.isLoading && (
        <p className="text-sm text-red-500">{t('states.error')}</p>
      )}

      {!screen.isLoading && screen.isEmpty && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-1">
          {t('comments.empty')}
        </p>
      )}

      {!screen.isLoading && visible.length > 0 && (
        <div className="space-y-3 mb-4">
          {visible.map((comment) => (
            <div key={comment.id} className="group flex gap-2.5">
              <AvatarInitial userId={comment.author_id} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                    {comment.author_id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {formatTimestamp(comment.created_at)}
                  </span>
                  {comment.updated_at !== comment.created_at && (
                    <span className="text-xs text-gray-400 italic">{t('comments.edited')}</span>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="mt-1">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, comment.id)}
                      rows={2}
                      aria-label={t('comments.edit')}
                      className="w-full rounded-md border border-indigo-400 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => handleEditSave(comment.id)}
                        className="rounded-lg bg-brand-primary px-3 py-1 text-xs font-medium text-white hover:bg-brand-hover transition-colors"
                      >
                        {t('comments.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        {t('comments.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                )}
              </div>

              {editingId !== comment.id && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0 transition-opacity">
                  <button
                    type="button"
                    onClick={() => startEdit(comment)}
                    aria-label={t('comments.edit')}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    aria-label={t('comments.delete')}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4H5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form
        aria-label={t('comments.add')}
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        className="flex gap-2 items-end"
      >
        <textarea
          ref={textareaRef}
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('comments.placeholder')}
          aria-label={t('comments.placeholder')}
          rows={2}
          disabled={submitting}
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={submitting || !newBody.trim()}
          className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50 shrink-0"
        >
          {t('comments.add')}
        </button>
      </form>
    </div>
  )
}
