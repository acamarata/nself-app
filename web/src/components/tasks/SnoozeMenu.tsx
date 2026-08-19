/**
 * SnoozeMenu.tsx — Quick "snooze to tomorrow / next week" due-date action
 * Purpose: Small popover button that bumps a task's due_date without opening
 *          the full detail panel. Used from TodoItem row actions and detail.
 * Inputs: dueDate (current, ISO | null), onSnooze(newDueDateIso) callback.
 * Outputs: Button that opens a 2-option menu (tomorrow 9am / next week 9am).
 * Constraints: <120 lines; preserves the existing time-of-day when one is set.
 * SPORT: D2-S7 snooze UX.
 */
import { useState } from 'react'
import { useT } from '@/lib/i18n'

interface SnoozeMenuProps {
  dueDate: string | null
  onSnooze: (nextDueDate: string) => void | Promise<void>
}

function snoozeTo(daysAhead: number, currentDueDate: string | null): string {
  const base = new Date()
  base.setDate(base.getDate() + daysAhead)
  if (currentDueDate) {
    const current = new Date(currentDueDate)
    base.setHours(current.getHours(), current.getMinutes(), 0, 0)
  } else {
    base.setHours(9, 0, 0, 0)
  }
  return base.toISOString()
}

export function SnoozeMenu({ dueDate, onSnooze }: SnoozeMenuProps) {
  const t = useT('tasks')
  const [open, setOpen] = useState(false)

  async function handlePick(daysAhead: number) {
    setOpen(false)
    await onSnooze(snoozeTo(daysAhead, dueDate))
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('snooze.title')}
        className="p-1 text-gray-400 hover:text-brand-primary transition-colors"
        title={t('snooze.title')}
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
          <path d="M8 4v4l2.5 2.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
            <button
              type="button"
              onClick={() => handlePick(1)}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('snooze.tomorrow')}
            </button>
            <button
              type="button"
              onClick={() => handlePick(7)}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t('snooze.nextWeek')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
