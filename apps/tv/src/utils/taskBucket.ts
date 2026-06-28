/**
 * Purpose: Pure date-bucketing logic for ɳTask TV — no React/urql deps.
 * Inputs: due_date (ISO string or null), today (YYYY-MM-DD string)
 * Outputs: 'today' | 'overdue' | 'upcoming'
 * Constraints:
 *   - No external dependencies — safe to import in Node.js test environment.
 *   - Exported from useTVTasks.ts via re-export for hook consumers.
 *   - Also used by TaskRowTV for display label logic.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

/**
 * Generate today's date string in YYYY-MM-DD format (local timezone).
 */
export function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Bucket a task by its due_date relative to today.
 *
 * @param dueDate — ISO date string or null (task without due date → 'upcoming')
 * @param today — today's date in YYYY-MM-DD format
 * @returns 'today' | 'overdue' | 'upcoming'
 */
export function bucketTaskByDate(
  dueDate: string | null,
  today: string,
): 'today' | 'overdue' | 'upcoming' {
  if (!dueDate) return 'upcoming'
  const due = dueDate.substring(0, 10) // 'YYYY-MM-DD'
  if (due === today) return 'today'
  if (due < today) return 'overdue'
  return 'upcoming'
}
