/**
 * due-date.ts — Helpers for splitting/combining a due_date timestamptz into
 * separate `<input type="date">` and `<input type="time">` control values.
 * Purpose: Shared by CreateTaskDialog and TaskDetailPanel so due date + time
 *          editing behaves identically in both places.
 * Inputs: ISO timestamptz strings (from np_todos.due_date) or date/time input strings.
 * Outputs: { date, time } split pair, or a combined ISO string.
 * Constraints: Pure functions, no side effects; local time zone (matches native
 *              date/time input semantics).
 * SPORT: D2-S7 due-date + time UX.
 */

/** Split an ISO due_date into `{ date: 'YYYY-MM-DD', time: 'HH:MM' }` input values. */
export function splitDueDate(dueDate: string | null): { date: string; time: string } {
  if (!dueDate) return { date: '', time: '' }
  const d = new Date(dueDate)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }

  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  // Only report a time component when it isn't exactly local midnight —
  // date-only due dates round-trip without an implied time-of-day.
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  const time = hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''
  return { date, time }
}

/**
 * Combine a `YYYY-MM-DD` date input value with an optional `HH:MM` time input
 * value into an ISO timestamptz string. Falls back to local midnight when no
 * time is given; returns undefined when no date is given.
 */
export function combineDueDateTime(date: string, time: string): string | undefined {
  if (!date) return undefined
  const iso = new Date(`${date}T${time || '00:00'}`)
  return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString()
}

/** True when the due_date carries a specific time-of-day (not just a date). */
export function hasDueTime(dueDate: string | null): boolean {
  if (!dueDate) return false
  const d = new Date(dueDate)
  return !Number.isNaN(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0)
}

/** Format the time-of-day portion of a due_date for display (locale-aware, short). */
export function formatDueTime(dueDate: string | null, locale: string): string | null {
  if (!hasDueTime(dueDate)) return null
  const d = new Date(dueDate as string)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d)
}
