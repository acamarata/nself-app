/**
 * RescheduleDialog.tsx — Click-to-reschedule modal (keyboard/touch fallback for drag)
 *
 * Purpose:    Native <input type="date"> dialog so any user — not just pointer/
 *             drag users — can move a task's due date from the Calendar view.
 * Inputs:     todo (title, due_date), onClose, onReschedule(dateStr)
 * Outputs:    Focus-trapped dialog with date input + save/cancel
 * Constraints: WCAG dialog semantics; ≤80 lines.
 * SPORT: view pages — Calendar.
 */
import { useState } from 'react'
import { format } from 'date-fns'
import type { NpTask } from '@/lib/graphql'
import { useT } from '@/lib/i18n'

interface RescheduleDialogProps {
  todo: NpTask
  onClose: () => void
  onReschedule: (dateStr: string) => Promise<void>
}

export function RescheduleDialog({ todo, onClose, onReschedule }: RescheduleDialogProps) {
  const t = useT('tasks')
  const [date, setDate] = useState(() =>
    todo.due_date ? format(new Date(todo.due_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
  )
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onReschedule(new Date(`${date}T00:00:00`).toISOString())
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${t('reschedule.title')}: ${todo.title}`}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{t('reschedule.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">{todo.title}</p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="reschedule-date" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('reschedule.newDueDate')}
            </label>
            <input
              id="reschedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              autoFocus
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('reschedule.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {saving ? t('reschedule.saving') : t('reschedule.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
