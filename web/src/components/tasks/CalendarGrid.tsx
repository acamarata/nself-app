/**
 * CalendarGrid.tsx — Month grid for /calendar
 *
 * Purpose:    Hand-built month grid (no calendar library) showing todo counts
 *             per day, drag-to-reschedule via native HTML5 DnD, and a
 *             keyboard-accessible day picker fallback.
 * Inputs:     monthAnchor (any Date within the visible month), todos, selectedDay,
 *             onSelectDay, onDropTodo(id, day)
 * Outputs:    7-column grid, Sun-start weeks, current month highlighted
 * Constraints: ≤300 lines; date-fns only; native draggable (no extra dep)
 * SPORT: view pages — Calendar.
 */
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
import { getTodosForDay } from '@/lib/task-date-groups'
import type { NpTask } from '@/lib/graphql'

interface CalendarGridProps {
  monthAnchor: Date
  todos: NpTask[]
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
  onDropTodo: (id: string, day: Date) => void
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarGrid({ monthAnchor, todos, selectedDay, onSelectDay, onDropTodo }: CalendarGridProps) {
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor))
    const end = endOfWeek(endOfMonth(monthAnchor))
    return eachDayOfInterval({ start, end })
  }, [monthAnchor])

  function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault()
    setDragOverDay(null)
    const id = e.dataTransfer.getData('text/todo-id')
    if (id) onDropTodo(id, day)
  }

  return (
    <div role="grid" aria-label={format(monthAnchor, 'MMMM yyyy')} className="select-none">
      <div className="grid grid-cols-7 mb-1" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="text-center text-xs font-medium text-gray-400 py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayTodos = getTodosForDay(todos, day)
          const inMonth = isSameMonth(day, monthAnchor)
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
          const isDragOver = dragOverDay === dayKey

          return (
            <button
              key={dayKey}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${format(day, 'EEEE, MMMM d')}${dayTodos.length ? `, ${dayTodos.length} tasks` : ''}`}
              onClick={() => onSelectDay(day)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverDay(dayKey)
              }}
              onDragLeave={() => setDragOverDay((prev) => (prev === dayKey ? null : prev))}
              onDrop={(e) => handleDrop(e, day)}
              className={clsx(
                'relative min-h-[4rem] p-1.5 text-left bg-white dark:bg-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary',
                !inMonth && 'bg-gray-50 dark:bg-gray-950 text-gray-300 dark:text-gray-700',
                isSelected && 'ring-2 ring-inset ring-brand-primary',
                isDragOver && 'bg-sky-50 dark:bg-indigo-900/30',
              )}
            >
              <span
                className={clsx(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  isToday(day)
                    ? 'bg-brand-primary text-white font-semibold'
                    : inMonth
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-300 dark:text-gray-700',
                )}
              >
                {format(day, 'd')}
              </span>
              {dayTodos.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {dayTodos.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className={clsx(
                        'h-1.5 w-1.5 rounded-full',
                        t.completed ? 'bg-gray-300 dark:bg-gray-600' : 'bg-brand-primary',
                      )}
                      aria-hidden="true"
                    />
                  ))}
                  {dayTodos.length > 3 && (
                    <span className="text-[10px] text-gray-400 leading-none">+{dayTodos.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
