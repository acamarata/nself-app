/**
 * components.test.tsx — RTL render tests for task components
 *
 * Purpose:    Verify TodoItem, ListCard, and OfflineBanner render without
 *             throwing and display the expected content.
 * Inputs:     Minimal mock props matching NpTaskSummary and NpList shapes.
 * Constraints: jsdom; BrowserRouter required for Link in ListCard.
 * SPORT:      D-S10-T1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Mock @/lib/offline-queue so OfflineBanner doesn't attempt IDB calls
vi.mock('@/lib/offline-queue', () => ({
  offlineQueue: {
    enqueue: vi.fn(),
    size: vi.fn().mockResolvedValue(0),
    drain: vi.fn().mockResolvedValue({ processed: 0, failed: 0 }),
  },
}))

// Mock @/lib/i18n so useT works in jsdom without the full bundle
vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

// Mock @nself/i18n (used by TodoItem for Hijri dates)
vi.mock('@nself/i18n', () => ({
  formatHijriDate: (_d: Date) => '1 Muharram 1446',
  formatLocaleDate: (d: Date, _locale: string) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
}))

// ─── OfflineBanner ────────────────────────────────────────────────────────────

describe('OfflineBanner', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  it('renders nothing when online and no pending changes', async () => {
    const { OfflineBanner } = await import('../components/tasks/OfflineBanner')
    const { container } = render(<OfflineBanner />)
    // online=true + pendingCount=0 → component returns null
    expect(container.firstChild).toBeNull()
  })
})

// ─── ListCard ────────────────────────────────────────────────────────────────

describe('ListCard', () => {
  const mockList = {
    id: 'list-1',
    user_id: 'user-1',
    title: 'My Test List',
    description: '',
    color: '#6366f1',
    icon: '',
    is_default: false,
    position: 0,
    group_id: null,
    source_account_id: 'primary',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('renders the list title', async () => {
    const { ListCard } = await import('../components/tasks/ListCard')
    render(
      <BrowserRouter>
        <ListCard list={mockList} />
      </BrowserRouter>
    )
    expect(screen.getByText('My Test List')).toBeInTheDocument()
  })

  it('renders the first letter of title as icon when icon is empty', async () => {
    const { ListCard } = await import('../components/tasks/ListCard')
    render(
      <BrowserRouter>
        <ListCard list={mockList} />
      </BrowserRouter>
    )
    // ListCard shows title[0].toUpperCase() when icon is empty
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('renders todoCount when provided', async () => {
    const { ListCard } = await import('../components/tasks/ListCard')
    render(
      <BrowserRouter>
        <ListCard list={mockList} todoCount={7} />
      </BrowserRouter>
    )
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('links to /lists/:id', async () => {
    const { ListCard } = await import('../components/tasks/ListCard')
    render(
      <BrowserRouter>
        <ListCard list={mockList} />
      </BrowserRouter>
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/lists/list-1')
  })
})

// ─── TodoItem ─────────────────────────────────────────────────────────────────

describe('TodoItem', () => {
  const mockTodo = {
    id: 'todo-1',
    list_id: 'list-1',
    title: 'Buy groceries',
    completed: false,
    priority: 'none' as const,
    due_date: null,
    position: 0,
    source_account_id: 'primary',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('renders the todo title', async () => {
    const { TodoItem } = await import('../components/tasks/TodoItem')
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<TodoItem todo={mockTodo} onToggle={onToggle} onDelete={onDelete} />)
    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
  })

  it('renders mark-complete button with accessible label', async () => {
    const { TodoItem } = await import('../components/tasks/TodoItem')
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<TodoItem todo={mockTodo} onToggle={onToggle} onDelete={onDelete} />)
    expect(screen.getByRole('button', { name: 'todoItem.markComplete' })).toBeInTheDocument()
  })

  it('shows "Mark incomplete" label when todo is completed', async () => {
    const { TodoItem } = await import('../components/tasks/TodoItem')
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <TodoItem
        todo={{ ...mockTodo, completed: true }}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    )
    expect(screen.getByRole('button', { name: 'todoItem.markIncomplete' })).toBeInTheDocument()
  })

  it('renders delete button with accessible label', async () => {
    const { TodoItem } = await import('../components/tasks/TodoItem')
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<TodoItem todo={mockTodo} onToggle={onToggle} onDelete={onDelete} />)
    expect(screen.getByRole('button', { name: 'todoItem.deleteTask: Buy groceries' })).toBeInTheDocument()
  })
})
