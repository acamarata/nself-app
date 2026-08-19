/**
 * coverage-board.test.tsx — RTL coverage for BoardPage, BoardColumn, BoardCard
 *
 * Purpose: Raise line coverage on the Kanban board surface (0% covered):
 *          BoardPage.tsx, BoardColumn.tsx, BoardCard.tsx.
 * SPORT: view pages — Board.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { NpTask, NpList } from '@/lib/graphql'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

const mockToggle = vi.fn().mockResolvedValue(undefined)
const mockSetPriority = vi.fn().mockResolvedValue(undefined)

let mockUseAllTodosReturn: {
  todos: NpTask[]
  lists: NpList[]
  loading: boolean
  error: string | null
  toggle: typeof mockToggle
  remove: ReturnType<typeof vi.fn>
  moveToList: ReturnType<typeof vi.fn>
  setPriority: typeof mockSetPriority
  setDueDate: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
}

vi.mock('@/hooks/useAllTodos', () => ({
  useAllTodos: () => mockUseAllTodosReturn,
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeTodo(overrides: Partial<NpTask> = {}): NpTask {
  return {
    id: 'todo-1',
    user_id: 'u-1',
    list_id: 'list-1',
    title: 'Sample task',
    description: '',
    completed: false,
    is_public: false,
    priority: 'none',
    notes: '',
    due_date: null,
    position: 0,
    source_account_id: 'primary',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    requires_approval: false,
    requires_photo: false,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    ...overrides,
  }
}

const makeList = (overrides: Partial<NpList> = {}): NpList => ({
  id: 'list-1',
  user_id: 'u-1',
  title: 'Work',
  description: '',
  color: '#f00',
  icon: '',
  is_default: false,
  position: 0,
  group_id: null,
  source_account_id: 'primary',
  created_at: '',
  updated_at: '',
  ...overrides,
})

function resetHookState(overrides: Partial<typeof mockUseAllTodosReturn> = {}) {
  mockUseAllTodosReturn = {
    todos: [],
    lists: [],
    loading: false,
    error: null,
    toggle: mockToggle,
    remove: vi.fn(),
    moveToList: vi.fn(),
    setPriority: mockSetPriority,
    setDueDate: vi.fn(),
    reload: vi.fn(),
    ...overrides,
  }
}

// ── BoardPage ────────────────────────────────────────────────────────────────

describe('BoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHookState()
  })

  it('shows loading skeleton while loading', async () => {
    resetHookState({ loading: true })
    const { BoardPage } = await import('@/pages/app/BoardPage')
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Board')).toBeInTheDocument()
    // TodoSkeleton renders pulse placeholders; board columns should not render yet
    expect(screen.queryByRole('list', { name: /column/i })).not.toBeInTheDocument()
  })

  it('shows empty state when there are no todos', async () => {
    resetHookState({ todos: [], loading: false })
    const { BoardPage } = await import('@/pages/app/BoardPage')
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('No tasks to show')).toBeInTheDocument()
  })

  it('shows error alert when error is set', async () => {
    resetHookState({ error: 'Failed to load tasks', todos: [] })
    const { BoardPage } = await import('@/pages/app/BoardPage')
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tasks')
  })

  it('renders columns grouped by priority and a Done column for completed todos', async () => {
    resetHookState({
      todos: [
        makeTodo({ id: 't-none', priority: 'none', title: 'No priority task' }),
        makeTodo({ id: 't-low', priority: 'low', title: 'Low task' }),
        makeTodo({ id: 't-medium', priority: 'medium', title: 'Medium task' }),
        makeTodo({ id: 't-high', priority: 'high', title: 'High task' }),
        makeTodo({ id: 't-urgent', priority: 'urgent', title: 'Urgent task' }),
        makeTodo({ id: 't-done', priority: 'low', completed: true, title: 'Done task' }),
      ],
      lists: [makeList()],
    })
    const { BoardPage } = await import('@/pages/app/BoardPage')
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('No priority task')).toBeInTheDocument()
    expect(screen.getByText('Low task')).toBeInTheDocument()
    expect(screen.getByText('Medium task')).toBeInTheDocument()
    expect(screen.getByText('High task')).toBeInTheDocument()
    expect(screen.getByText('Urgent task')).toBeInTheDocument()
    expect(screen.getByText('Done task')).toBeInTheDocument()

    // Column headers rendered
    expect(screen.getByText('No priority')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders list filter select with list options and filters todos by list', async () => {
    const user = userEvent.setup()
    resetHookState({
      todos: [
        makeTodo({ id: 't-1', list_id: 'list-1', title: 'List one task' }),
        makeTodo({ id: 't-2', list_id: 'list-2', title: 'List two task' }),
      ],
      lists: [makeList({ id: 'list-1', title: 'Work' }), makeList({ id: 'list-2', title: 'Home' })],
    })
    const { BoardPage } = await import('@/pages/app/BoardPage')
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('List one task')).toBeInTheDocument()
    expect(screen.getByText('List two task')).toBeInTheDocument()

    const select = screen.getByLabelText('List') as HTMLSelectElement
    await user.selectOptions(select, 'list-1')

    await waitFor(() => {
      expect(screen.getByText('List one task')).toBeInTheDocument()
      expect(screen.queryByText('List two task')).not.toBeInTheDocument()
    })
  })

  it('renders card due dates when present', async () => {
    resetHookState({
      todos: [makeTodo({ id: 't-due', due_date: '2026-07-15T12:00:00Z', title: 'Due task' })],
    })
    const { BoardPage } = await import('@/pages/app/BoardPage')
    render(
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Due task')).toBeInTheDocument()
    expect(screen.getByText('Jul 15')).toBeInTheDocument()
  })
})

// ── BoardColumn ──────────────────────────────────────────────────────────────

describe('BoardColumn', () => {
  it('renders "No tasks" placeholder when todos array is empty', async () => {
    const { BoardColumn } = await import('@/components/tasks/BoardColumn')
    render(<BoardColumn id="low" title="Low" accentClass="bg-blue-400" todos={[]} />)
    expect(screen.getByText('No tasks')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders card count and cards for populated column', async () => {
    const { BoardColumn } = await import('@/components/tasks/BoardColumn')
    const todos = [makeTodo({ id: 'c-1', title: 'Card one' }), makeTodo({ id: 'c-2', title: 'Card two' })]
    render(<BoardColumn id="low" title="Low" accentClass="bg-blue-400" todos={todos} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Card one')).toBeInTheDocument()
    expect(screen.getByText('Card two')).toBeInTheDocument()
  })

  it('exposes column list aria-label', async () => {
    const { BoardColumn } = await import('@/components/tasks/BoardColumn')
    render(<BoardColumn id="urgent" title="Urgent" accentClass="bg-red-400" todos={[]} />)
    expect(screen.getByRole('list', { name: 'Urgent column' })).toBeInTheDocument()
  })
})

// ── BoardCard ────────────────────────────────────────────────────────────────

describe('BoardCard', () => {
  it('renders title', async () => {
    const { BoardCard } = await import('@/components/tasks/BoardCard')
    render(<BoardCard todo={makeTodo({ title: 'My card title' })} />)
    expect(screen.getByText('My card title')).toBeInTheDocument()
  })

  it('renders due date when present', async () => {
    const { BoardCard } = await import('@/components/tasks/BoardCard')
    render(<BoardCard todo={makeTodo({ due_date: '2026-08-01T12:00:00Z' })} />)
    expect(screen.getByText('Aug 1')).toBeInTheDocument()
  })

  it('does not render a due date paragraph when due_date is null', async () => {
    const { BoardCard } = await import('@/components/tasks/BoardCard')
    const { container } = render(<BoardCard todo={makeTodo({ due_date: null })} />)
    // Only the title <p> should be present
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('applies line-through style when completed', async () => {
    const { BoardCard } = await import('@/components/tasks/BoardCard')
    render(<BoardCard todo={makeTodo({ title: 'Done card', completed: true })} />)
    expect(screen.getByText('Done card')).toHaveClass('line-through')
  })

  it('exposes listitem role and sortable aria-roledescription', async () => {
    const { BoardCard } = await import('@/components/tasks/BoardCard')
    render(<BoardCard todo={makeTodo({ title: 'A11y card' })} />)
    const card = screen.getByRole('listitem')
    expect(card).toHaveAttribute('aria-roledescription', 'sortable task card')
  })
})
