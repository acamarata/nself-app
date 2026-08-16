/**
 * Purpose: Unit tests for ListViewScreen's bucket-filtering logic.
 * Tests the task-set selection without React/RN rendering.
 * Note: Component rendering tests require react-native-tvos env fix (see SPIKE.md),
 * same constraint as GlanceCard.test.ts.
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import type { NpTask } from '@nself/ntask-core'

// ─── Mirror of ListViewScreen's bucket-selection logic ─────────────────────────

type Bucket = 'today' | 'overdue' | 'upcoming' | undefined

function selectTasks(
  bucket: Bucket,
  overdueTasks: NpTask[],
  todayTasks: NpTask[],
  upcomingTasks: NpTask[],
): NpTask[] {
  return bucket === 'today'
    ? todayTasks
    : bucket === 'overdue'
      ? overdueTasks
      : bucket === 'upcoming'
        ? upcomingTasks
        : [...overdueTasks, ...todayTasks, ...upcomingTasks]
}

function makeTask(id: string): NpTask {
  return {
    id,
    title: `Task ${id}`,
    user_id: 'user-1',
    list_id: 'list-1',
    description: '',
    completed: false,
    is_public: false,
    priority: 'none',
    notes: '',
    due_date: null,
    position: 0,
    source_account_id: 'primary',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    requires_approval: false,
    requires_photo: false,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
  }
}

describe('ListViewScreen — bucket filtering', () => {
  const overdue = [makeTask('o1'), makeTask('o2')]
  const today = [makeTask('t1')]
  const upcoming = [makeTask('u1'), makeTask('u2'), makeTask('u3')]

  test('bucket=overdue returns only overdue tasks', () => {
    const result = selectTasks('overdue', overdue, today, upcoming)
    expect(result).toEqual(overdue)
  })

  test('bucket=today returns only today tasks', () => {
    const result = selectTasks('today', overdue, today, upcoming)
    expect(result).toEqual(today)
  })

  test('bucket=upcoming returns only upcoming tasks', () => {
    const result = selectTasks('upcoming', overdue, today, upcoming)
    expect(result).toEqual(upcoming)
  })

  test('bucket=undefined (sidebar nav) returns the full concatenated list', () => {
    const result = selectTasks(undefined, overdue, today, upcoming)
    expect(result).toEqual([...overdue, ...today, ...upcoming])
    expect(result).toHaveLength(6)
  })

  test('an empty bucket yields an empty array, not a fallback to the full list', () => {
    const result = selectTasks('today', overdue, [], upcoming)
    expect(result).toEqual([])
  })
})
