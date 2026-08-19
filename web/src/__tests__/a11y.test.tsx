/**
 * a11y.test.tsx — WCAG 2.1 AA automated axe assertions for web/ntask components.
 *
 * Purpose:    Run axe-core via jest-axe on key UI components and verify zero
 *             accessibility violations. Implements N-S1-T1 (web a11y gate).
 * Inputs:     Rendered component trees via @testing-library/react.
 * Outputs:    Jest assertions: toHaveNoViolations() on each component.
 * Constraints:
 *   - Runs under vitest with jsdom environment.
 *   - jest-axe is compatible with vitest via the expect.extend() API.
 *   - Components with external deps (graphql, i18n, router) are mocked.
 *   - BrowserRouter wraps Link-bearing components.
 *   - axe-core checks: WCAG2A + WCAG2AA rules only (no experimental).
 * SPORT: N-S1-T1 (web WCAG 2.1 AA + jest-axe gate)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Register the jest-axe matcher with vitest's expect
beforeAll(() => {
  expect.extend(toHaveNoViolations)
})

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/offline-queue', () => ({
  offlineQueue: {
    enqueue: vi.fn(),
    size: vi.fn().mockResolvedValue(0),
    drain: vi.fn().mockResolvedValue({ processed: 0, failed: 0 }),
  },
}))

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar', 'fr', 'es'],
  initLocale: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@nself/i18n', () => ({
  formatHijriDate: () => '1 Muharram 1446',
  formatLocaleDate: (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
}))

vi.mock('@/lib/graphql', () => ({
  getLists: vi.fn().mockResolvedValue([]),
  getTodos: vi.fn().mockResolvedValue([]),
  createTodo: vi.fn(),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

const baseList = {
  id: 'list-1',
  title: 'Shopping',
  description: 'Weekly groceries',
  color: '#0ea5e9',
  icon: '🛒',
  user_id: 'user-1',
  source_account_id: 'primary',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('a11y: EmptyState (tasks)', () => {
  it('has no axe violations', async () => {
    const { EmptyState } = await import('../components/tasks/EmptyState')
    const { container } = render(
      <EmptyState
        title="No tasks yet"
        description="Add your first task to get started."
        action={<button type="button">Add task</button>}
      />,
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('a11y: EmptyState (shared cta)', () => {
  it('has no axe violations', async () => {
    const { EmptyState } = await import('../components/tasks/EmptyState')
    const { container } = render(
      <BrowserRouter>
        <EmptyState
          title="Nothing here"
          description="Try creating something new."
          cta={{ label: 'Create', href: '/new' }}
        />
      </BrowserRouter>,
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('a11y: ListCard', () => {
  it('has no axe violations', async () => {
    const { ListCard } = await import('../components/tasks/ListCard')
    const { container } = render(
      <BrowserRouter>
        <ListCard list={baseList} todoCount={5} />
      </BrowserRouter>,
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('a11y: ListSkeleton', () => {
  it('has no axe violations', async () => {
    const { ListSkeleton } = await import('../components/tasks/LoadingSkeleton')
    const { container } = render(<ListSkeleton />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('a11y: NotFoundPage', () => {
  it('has no axe violations', async () => {
    const { NotFoundPage } = await import('../pages/NotFoundPage')
    const { container } = render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>,
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
