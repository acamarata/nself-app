/**
 * NewTodoInput.tsx — Inline todo creation input component
 *
 * Purpose:    Single-line input for quickly adding todos to the active list.
 *             Submits on Enter; cancels on Escape. Auto-focuses on mount.
 * Inputs:     onAdd: (text: string) => Promise<void>, listId: string
 * Outputs:    Controlled text input with submit/cancel handlers
 * Constraints: Must remain responsive during the async onAdd call (disable + spinner)
 */
import { useState, useRef } from 'react'
import { useT } from '@/lib/i18n'

interface NewTodoInputProps {
  onAdd: (title: string) => Promise<void>
  placeholder?: string
}

export function NewTodoInput({ onAdd, placeholder }: NewTodoInputProps) {
  const t = useT('tasks')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = value.trim()
    if (!title) return

    setLoading(true)
    setValue('')
    await onAdd(title)
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? t('newTodo.placeholder')}
        disabled={loading}
        className="flex-1 text-sm bg-transparent focus-visible:outline-none placeholder-gray-400 text-gray-900 dark:text-white dark:placeholder-gray-500 disabled:opacity-50"
      />
      {value.trim() && (
        <button
          type="submit"
          disabled={loading}
          className="flex-shrink-0 text-xs font-medium text-brand-primary hover:text-brand-primary dark:text-brand-link disabled:opacity-50"
        >
          {loading ? t('newTodo.adding') : t('newTodo.add')}
        </button>
      )}
    </form>
  )
}
