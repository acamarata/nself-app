/**
 * task-date-groups.ts — Date-bucketing helpers shared by Today/Upcoming/Calendar/Logbook
 *
 * Purpose:    Pure functions that classify NpTask rows into day-relative buckets.
 *             Kept framework-free so each view page can compose its own grouping UI.
 * Inputs:     NpTask[] (due_date / updated_at ISO strings)
 * Outputs:    Grouped record keyed by bucket label or ISO day string
 * Constraints: date-fns only (no heavy calendar lib); local timezone throughout.
 * SPORT: view pages — Today/Upcoming/Inbox/Logbook/Calendar/Board.
 */
import {
  startOfDay,
  isBefore,
  isSameDay,
  isWithinInterval,
  addDays,
  format,
} from 'date-fns'
import type { NpTask } from '@/lib/graphql'

/** Parse a due_date string to a Date, or null if absent/invalid. */
export function parseDueDate(dueDate: string | null): Date | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Todos due strictly before today (start of day), excluding completed. */
export function getOverdueTodos(todos: NpTask[], now = new Date()): NpTask[] {
  const todayStart = startOfDay(now)
  return todos.filter((t) => {
    if (t.completed) return false
    const due = parseDueDate(t.due_date)
    return due !== null && isBefore(due, todayStart)
  })
}

/** Todos due today (any time), excluding completed. */
export function getTodayTodos(todos: NpTask[], now = new Date()): NpTask[] {
  return todos.filter((t) => {
    if (t.completed) return false
    const due = parseDueDate(t.due_date)
    return due !== null && isSameDay(due, now)
  })
}

/** Todos due within the next N days (exclusive of today), excluding completed. */
export function getUpcomingByDay(
  todos: NpTask[],
  days = 7,
  now = new Date(),
): { day: Date; label: string; todos: NpTask[] }[] {
  const todayStart = startOfDay(now)
  const groups: { day: Date; label: string; todos: NpTask[] }[] = []
  for (let i = 1; i <= days; i++) {
    const day = addDays(todayStart, i)
    const dayTodos = todos.filter((t) => {
      if (t.completed) return false
      const due = parseDueDate(t.due_date)
      return due !== null && isSameDay(due, day)
    })
    groups.push({ day, label: format(day, 'EEEE, MMM d'), todos: dayTodos })
  }
  return groups
}

/** Todos due after the N-day upcoming window (open-ended "Later" bucket). */
export function getLaterTodos(todos: NpTask[], days = 7, now = new Date()): NpTask[] {
  const cutoff = addDays(startOfDay(now), days)
  return todos.filter((t) => {
    if (t.completed) return false
    const due = parseDueDate(t.due_date)
    return due !== null && !isBefore(due, addDays(cutoff, 1))
  })
}

/** Todos with no list assigned, or assigned to the account's default list. */
export function getInboxTodos(todos: NpTask[], defaultListId: string | null): NpTask[] {
  return todos.filter((t) => t.list_id === null || (defaultListId !== null && t.list_id === defaultListId))
}

/** Completed todos grouped by completion date (falls back to updated_at), newest first. */
export function getLogbookGroups(todos: NpTask[]): { day: Date; label: string; todos: NpTask[] }[] {
  const completed = todos.filter((t) => t.completed)
  const byDay = new Map<string, { day: Date; todos: NpTask[] }>()
  for (const t of completed) {
    const completedAt = new Date(t.updated_at)
    const dayKey = format(startOfDay(completedAt), 'yyyy-MM-dd')
    const existing = byDay.get(dayKey)
    if (existing) {
      existing.todos.push(t)
    } else {
      byDay.set(dayKey, { day: startOfDay(completedAt), todos: [t] })
    }
  }
  return Array.from(byDay.values())
    .sort((a, b) => b.day.getTime() - a.day.getTime())
    .map(({ day, todos: dayTodos }) => ({
      day,
      label: format(day, 'EEEE, MMM d, yyyy'),
      todos: dayTodos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    }))
}

/** Todos due on a specific calendar day (for month-grid cell lookups). */
export function getTodosForDay(todos: NpTask[], day: Date): NpTask[] {
  return todos.filter((t) => {
    const due = parseDueDate(t.due_date)
    return due !== null && isSameDay(due, day)
  })
}

/** True if `day` falls within [start, end] inclusive. */
export function isDayWithinRange(day: Date, start: Date, end: Date): boolean {
  return isWithinInterval(day, { start: startOfDay(start), end: startOfDay(end) })
}
