/**
 * CalendarPage.tsx — /calendar — month grid + week strip by due_date
 *
 * Purpose:    Visual calendar of due dates across all lists. Desktop shows the
 *             month grid; narrow viewports show a compact week strip. Clicking
 *             a day lists its tasks; dragging a task onto a day reschedules it
 *             (native HTML5 DnD); a click-to-reschedule dialog covers keyboard/
 *             touch users who can't drag.
 * Inputs:     useAllTodos() — cross-list GraphQL data hook
 * Outputs:    Month/week calendar + selected-day task list + reschedule dialog
 * Constraints: ≤300 lines; date-fns only (no calendar lib); a11y grid semantics
 * SPORT: view pages — Calendar.
 */
import { useMemo, useState } from 'react'
import { addMonths, subMonths, format, startOfDay, isSameDay } from 'date-fns'
import { useAllTodos } from '@/hooks/useAllTodos'
import { getTodosForDay } from '@/lib/task-date-groups'
import { CalendarGrid } from '@/components/tasks/CalendarGrid'
import { WeekStrip } from '@/components/tasks/WeekStrip'
import { RescheduleDialog } from '@/components/tasks/RescheduleDialog'
import { TodoItem } from '@/components/tasks/TodoItem'
import { TodoSkeleton } from '@/components/tasks/LoadingSkeleton'
import { EmptyState } from '@/components/tasks/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useT } from '@/lib/i18n'
import type { NpTask } from '@/lib/graphql'

export function CalendarPage() {
  usePageMeta({ title: 'Calendar' })
  const t = useT('tasks')
  const { todos, loading, error, toggle, remove, setDueDate } = useAllTodos()
  const [monthAnchor, setMonthAnchor] = useState(() => startOfDay(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => startOfDay(new Date()))
  const [rescheduling, setRescheduling] = useState<NpTask | null>(null)

  const selectedDayTodos = useMemo(
    () => (selectedDay ? getTodosForDay(todos, selectedDay) : []),
    [todos, selectedDay],
  )

  async function handleDropTodo(id: string, day: Date) {
    await setDueDate(id, day.toISOString())
  }

  function handleDragStart(e: React.DragEvent, todo: NpTask) {
    e.dataTransfer.setData('text/todo-id', todo.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('calendar.title')}</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonthAnchor((m) => subMonths(m, 1))}
            aria-label={t('calendar.previousMonth')}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-28 text-center">
            {format(monthAnchor, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
            aria-label={t('calendar.nextMonth')}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <TodoSkeleton />
      ) : (
        <>
          {/* Month grid — hidden on narrow viewports */}
          <div className="hidden sm:block mb-6">
            <CalendarGrid
              monthAnchor={monthAnchor}
              todos={todos}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onDropTodo={handleDropTodo}
            />
          </div>

          {/* Week strip — mobile only */}
          <div className="sm:hidden mb-6">
            <WeekStrip
              weekAnchor={monthAnchor}
              todos={todos}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          </div>

          <section aria-labelledby="selected-day-heading">
            <h2 id="selected-day-heading" className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1">
              {selectedDay ? format(selectedDay, 'EEEE, MMM d') : t('calendar.selectDay')} · {selectedDayTodos.length}
            </h2>

            {selectedDayTodos.length === 0 ? (
              <EmptyState icon="🗓️" title={t('calendar.emptyTitle')} description={t('calendar.emptyDescription')} />
            ) : (
              <ul role="list" className="space-y-1">
                {selectedDayTodos.map((todo) => (
                  <li
                    key={todo.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, todo)}
                    className="group relative"
                  >
                    <div className="flex items-center">
                      <div className="flex-1 min-w-0">
                        <TodoItem todo={todo} onToggle={toggle} onDelete={remove} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRescheduling(todo)}
                        aria-label={t('calendar.rescheduleAria').replace('{{title}}', todo.title)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 p-1.5 mr-1 text-gray-400 hover:text-brand-primary transition-colors"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {rescheduling && (
        <RescheduleDialog
          todo={rescheduling}
          onClose={() => setRescheduling(null)}
          onReschedule={async (dateStr) => {
            await setDueDate(rescheduling.id, dateStr)
            if (!isSameDay(new Date(dateStr), selectedDay ?? new Date())) {
              setSelectedDay(startOfDay(new Date(dateStr)))
            }
          }}
        />
      )}
    </div>
  )
}
