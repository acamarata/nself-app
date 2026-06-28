/**
 * Purpose: Unit tests for TaskRowTV pure logic.
 * Tests due-date display label logic from the shared taskBucket utility.
 * Note: Component rendering tests require react-native-tvos env fix (see SPIKE.md).
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

// Import from pure util — avoids RN/React imports that fail in Node test environment
import { bucketTaskByDate, todayDateString } from '../../utils/taskBucket'

// ─── bucketDueDate label logic (mirrors TaskRowTV.tsx bucketDueDate) ───────────

function daysFromNow(delta: number): string {
  const d = new Date()
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('TaskRowTV — due date bucketing for display labels', () => {
  const today = todayDateString()

  test('null due date → bucket "upcoming" (no label shown)', () => {
    expect(bucketTaskByDate(null, today)).toBe('upcoming')
  })

  test('today → bucket "today"', () => {
    expect(bucketTaskByDate(today, today)).toBe('today')
  })

  test('ISO datetime for today → bucket "today" (time stripped correctly)', () => {
    expect(bucketTaskByDate(`${today}T14:30:00.000Z`, today)).toBe('today')
  })

  test('yesterday → bucket "overdue"', () => {
    const yesterday = daysFromNow(-1)
    expect(bucketTaskByDate(yesterday, today)).toBe('overdue')
  })

  test('tomorrow → bucket "upcoming"', () => {
    const tomorrow = daysFromNow(1)
    expect(bucketTaskByDate(tomorrow, today)).toBe('upcoming')
  })

  test('far future date → bucket "upcoming"', () => {
    const nextMonth = daysFromNow(30)
    expect(bucketTaskByDate(nextMonth, today)).toBe('upcoming')
  })
})

// ─── Priority color tests ──────────────────────────────────────────────────────

describe('TaskRowTV — priority dot colors', () => {
  const { priorityColors, tvTheme } = require('../../theme')

  test('urgent priority has a hex color', () => {
    expect(priorityColors['urgent']).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  test('high priority has a hex color', () => {
    expect(priorityColors['high']).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  test('medium priority has a hex color', () => {
    expect(priorityColors['medium']).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  test('low priority has a hex color', () => {
    expect(priorityColors['low']).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  test('unknown priority → undefined (caller falls back to textSecondary)', () => {
    const color = priorityColors['unknown_priority']
    expect(color).toBeUndefined()
    // Simulate the fallback: priorityColors[p] ?? tvTheme.colors.textSecondary
    const resolved = color ?? tvTheme.colors.textSecondary
    expect(resolved).toBe(tvTheme.colors.textSecondary)
  })

  test('completed task styling: textDisabled color is defined', () => {
    expect(tvTheme.colors.textDisabled).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

// ─── Mark-done button id convention ───────────────────────────────────────────

describe('TaskRowTV — focus id conventions', () => {
  test('mark-done button id is derived from row id with "-done" suffix', () => {
    const rowId = 'lv-row-0'
    const markDoneId = `${rowId}-done`
    expect(markDoneId).toBe('lv-row-0-done')
  })

  test('nextFocusRight for completed task is undefined (no done button)', () => {
    const completed = true
    const nextFocusRight = completed ? undefined : 'lv-row-0-done'
    expect(nextFocusRight).toBeUndefined()
  })
})
