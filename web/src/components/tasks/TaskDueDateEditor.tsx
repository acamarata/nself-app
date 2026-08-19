/**
 * TaskDueDateEditor.tsx — Due date + time editor for TaskDetailPanel
 * Purpose: Split due_date timestamptz editing into separate date/time inputs.
 * Inputs: dueDate (ISO | null), onChange(nextIso | null) callback.
 * Outputs: Two native inputs (date, time) + a clear button.
 * Constraints: <120 lines; time input disabled until a date is chosen.
 * SPORT: D2-S7 due-date + time UX.
 */
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { splitDueDate, combineDueDateTime } from '@/lib/due-date'

interface TaskDueDateEditorProps {
  dueDate: string | null
  onChange: (nextIso: string | null) => void | Promise<void>
}

export function TaskDueDateEditor({ dueDate, onChange }: TaskDueDateEditorProps) {
  const t = useT('tasks')
  const [{ date, time }, setSplit] = useState(() => splitDueDate(dueDate))

  useEffect(() => { setSplit(splitDueDate(dueDate)) }, [dueDate])

  function commit(nextDate: string, nextTime: string) {
    setSplit({ date: nextDate, time: nextTime })
    const combined = combineDueDateTime(nextDate, nextTime)
    onChange(combined ?? null)
  }

  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {t('createTask.dueDate')}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => commit(e.target.value, time)}
          aria-label={t('createTask.dueDate')}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => commit(date, e.target.value)}
          disabled={!date}
          aria-label={t('createTask.dueTime')}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
        />
        {date && (
          <button
            type="button"
            onClick={() => commit('', '')}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            {t('createTask.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
