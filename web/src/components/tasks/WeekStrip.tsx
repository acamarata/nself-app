/**
 * WeekStrip.tsx — Horizontal 7-day strip for /calendar (mobile-friendly)
 *
 * Purpose:    Compact alternative to the month grid — one row of the current
 *             week with per-day task-count dots, for narrow viewports.
 * Inputs:     weekAnchor (any Date within the visible week), todos, selectedDay, onSelectDay
 * Outputs:    7-column horizontal day strip
 * Constraints: ≤80 lines; date-fns only.
 * SPORT: view pages — Calendar.
 */
import clsx from 'clsx'
import { startOfWeek, addDays, isSameDay, isToday, format } from 'date-fns'
import { getTodosForDay } from '@/lib/task-date-groups'
import type { NpTask } from '@/lib/graphql'

interface WeekStripProps {
  weekAnchor: Date
  todos: NpTask[]
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
}

export function WeekStrip({ weekAnchor, todos, selectedDay, onSelectDay }: WeekStripProps) {
  const start = startOfWeek(weekAnchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  return (
    <div role="row" aria-label="Week" className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const dayTodos = getTodosForDay(todos, day)
        const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
        return (
          <button
            key={day.toISOString()}
            type="button"
            role="gridcell"
            aria-selected={isSelected}
            aria-label={`${format(day, 'EEEE, MMMM d')}${dayTodos.length ? `, ${dayTodos.length} tasks` : ''}`}
            onClick={() => onSelectDay(day)}
            className={clsx(
              'flex flex-col items-center gap-1 rounded-lg py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary',
              isSelected ? 'bg-sky-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
            )}
          >
            <span className="text-[10px] font-medium text-gray-400 uppercase">{format(day, 'EEE')}</span>
            <span
              className={clsx(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                isToday(day) ? 'bg-brand-primary text-white font-semibold' : 'text-gray-700 dark:text-gray-300',
              )}
            >
              {format(day, 'd')}
            </span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dayTodos.length ? '#6366f1' : 'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}
