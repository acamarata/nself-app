/**
 * NewListModal.tsx — ɳTask new task list creation modal
 *
 * Purpose:    Modal dialog for creating a new task list with name and color
 *             selection. Submits via GraphQL mutation on confirm.
 * Inputs:     isOpen: boolean, onClose: () => void, onCreate: (name, color) => Promise<void>
 * Outputs:    Modal with text input + color picker
 * Constraints: No external modal lib. role="dialog"/aria-modal/aria-labelledby
 *             + real focus trap + Escape + focus restore via the shared
 *             useFocusTrap hook (src/hooks/useFocusTrap.ts). Backdrop click
 *             closes; clicks inside the dialog do not.
 */
'use client'

import { useRef, useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4',
]

interface NewListModalProps {
  onClose: () => void
  onCreate: (title: string, color: string, icon: string) => Promise<void>
}

export function NewListModal({ onClose, onCreate }: NewListModalProps) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, onClose)

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return

    setLoading(true)
    setError(null)
    try {
      await onCreate(t, color, 'list')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-list-modal-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-6 outline-none"
      >
        <h2 id="new-list-modal-title" className="text-base font-semibold text-gray-900 dark:text-white mb-4">New list</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My list"
              autoFocus
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
