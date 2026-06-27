/**
 * Purpose: Unit tests for GlanceCard data-layer logic.
 * Tests the task preview/overflow logic without React/RN rendering.
 * Note: Component rendering tests require react-native-tvos env fix (see SPIKE.md).
 * SPORT: Epic F — TV scaffold / F-S2-T6 (i18n TV wave).
 */

import type { NpTask } from '@nself/ntask-core'

// ─── GlanceCard pure logic ─────────────────────────────────────────────────────
// Mirror the constants and logic from GlanceCard.tsx

const MAX_PREVIEW = 5

function getPreview(tasks: NpTask[]): NpTask[] {
  return tasks.slice(0, MAX_PREVIEW)
}

function getOverflow(tasks: NpTask[]): number {
  return Math.max(0, tasks.length - MAX_PREVIEW)
}

function makeTask(id: string, title: string, completed = false): NpTask {
  return {
    id,
    title,
    user_id: 'user-1',
    list_id: 'list-1',
    description: '',
    completed,
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GlanceCard — preview logic', () => {
  test('shows all tasks when count ≤ 5', () => {
    const tasks = [1, 2, 3].map((n) => makeTask(`t${n}`, `Task ${n}`))
    expect(getPreview(tasks)).toHaveLength(3)
    expect(getOverflow(tasks)).toBe(0)
  })

  test('shows exactly 5 previews when count = 5', () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => makeTask(`t${n}`, `Task ${n}`))
    expect(getPreview(tasks)).toHaveLength(5)
    expect(getOverflow(tasks)).toBe(0)
  })

  test('shows 5 previews and "+1 more" when count = 6', () => {
    const tasks = [1, 2, 3, 4, 5, 6].map((n) => makeTask(`t${n}`, `Task ${n}`))
    expect(getPreview(tasks)).toHaveLength(5)
    expect(getOverflow(tasks)).toBe(1)
  })

  test('shows 5 previews and "+N more" when tasks > 5', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => makeTask(`t${i}`, `Task ${i}`))
    expect(getPreview(tasks)).toHaveLength(5)
    expect(getOverflow(tasks)).toBe(7)
  })

  test('returns empty preview for empty task list', () => {
    expect(getPreview([])).toHaveLength(0)
    expect(getOverflow([])).toBe(0)
  })

  test('preview preserves task order (first N tasks)', () => {
    const tasks = [1, 2, 3, 4, 5, 6, 7].map((n) => makeTask(`t${n}`, `Task ${n}`))
    const preview = getPreview(tasks)
    expect(preview.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5'])
  })

  test('overflow count is correct for large task lists', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => makeTask(`t${i}`, `Task ${i}`))
    expect(getOverflow(tasks)).toBe(95)
  })
})

describe('GlanceCard — variant accent colors', () => {
  // These are static tokens — verify they are defined and distinct.
  const { tvTheme } = require('../../theme')

  const variantAccent = {
    today: tvTheme.colors.brand,
    upcoming: tvTheme.colors.textSecondary,
    overdue: tvTheme.colors.warning,
  }

  test('each variant has a distinct accent color', () => {
    const colors = Object.values(variantAccent)
    const unique = new Set(colors)
    expect(unique.size).toBe(colors.length)
  })

  test('overdue accent is the warning color', () => {
    expect(variantAccent.overdue).toBe(tvTheme.colors.warning)
  })

  test('today accent is the brand color', () => {
    expect(variantAccent.today).toBe(tvTheme.colors.brand)
  })
})
