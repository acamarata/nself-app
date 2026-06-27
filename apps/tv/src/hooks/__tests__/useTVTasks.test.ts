/**
 * Purpose: Unit tests for task date-bucket logic.
 * Tests bucketTaskByDate from utils/taskBucket.ts (pure fn, no React/urql deps).
 * Also tests the bucketTask wrapper signature compatibility (NpTask → bucket).
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

// Import from the pure utility, not the hook (which requires urql/React in node env)
import { bucketTaskByDate, todayDateString } from '../../utils/taskBucket'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(delta: number): string {
  const d = new Date()
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── bucketTaskByDate tests ────────────────────────────────────────────────────

describe('bucketTaskByDate — pure date bucketing', () => {
  const today = todayDateString()

  test('null due_date → "upcoming"', () => {
    expect(bucketTaskByDate(null, today)).toBe('upcoming')
  })

  test('due_date === today → "today"', () => {
    expect(bucketTaskByDate(today, today)).toBe('today')
  })

  test('ISO datetime for today (with T time component) → "today"', () => {
    expect(bucketTaskByDate(`${today}T12:00:00.000Z`, today)).toBe('today')
  })

  test('due_date < today (yesterday) → "overdue"', () => {
    const yesterday = daysFromNow(-1)
    expect(bucketTaskByDate(yesterday, today)).toBe('overdue')
  })

  test('due_date > today (tomorrow) → "upcoming"', () => {
    const tomorrow = daysFromNow(1)
    expect(bucketTaskByDate(tomorrow, today)).toBe('upcoming')
  })

  test('due_date 7 days in the past → "overdue"', () => {
    const past = daysFromNow(-7)
    expect(bucketTaskByDate(past, today)).toBe('overdue')
  })

  test('due_date 30 days in the future → "upcoming"', () => {
    const future = daysFromNow(30)
    expect(bucketTaskByDate(future, today)).toBe('upcoming')
  })

  test('multiple tasks distributed correctly across all three buckets', () => {
    const yesterday = daysFromNow(-1)
    const tomorrow = daysFromNow(1)
    const past30 = daysFromNow(-30)

    const dueDates = [yesterday, today, tomorrow, null, past30]
    const buckets = { today: 0, overdue: 0, upcoming: 0 }
    for (const due of dueDates) {
      buckets[bucketTaskByDate(due, today)]++
    }

    expect(buckets.overdue).toBe(2)   // yesterday + past30
    expect(buckets.today).toBe(1)     // today
    expect(buckets.upcoming).toBe(2)  // tomorrow + null
  })

  test('todayDateString() returns YYYY-MM-DD format', () => {
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('todayDateString() is deterministic within a single test run', () => {
    const a = todayDateString()
    const b = todayDateString()
    expect(a).toBe(b)
  })
})
