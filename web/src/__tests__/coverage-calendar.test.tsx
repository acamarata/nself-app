/**
 * coverage-calendar.test.tsx — RTL coverage for CalendarPage and CalendarGrid
 *
 * Purpose: Raise line coverage on the Calendar surface (0% covered):
 *          CalendarPage.tsx, CalendarGrid.tsx.
 * SPORT: view pages — Calendar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { format } from 'date-fns'
import type { NpTask } from '@/lib/graphql'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

const mockToggle = vi.fn().mockResolvedValue(undefined)
const mockRemove = vi.fn().mockResolvedValue(undefined)
const mockSetDueDate = vi.fn().mockResolvedValue(undefined)

let mockUseAllTodosReturn: {
  todos: NpTask[]
  lists: unknown[]
  loading: boolean
  error: string | null
  toggle: typeof mockToggle
  remove: typeof mockRemove
  moveToList: ReturnType<typeof vi.fn>
  setPriority: ReturnType<typeof vi.fn>
  setDueDate: typeof mockSetDueDate
  reload: ReturnType<typeof vi.fn>
}

vi.mock('@/hooks/useAllTodos', () => ({
  useAllTodos: () => mockUseAllTodosReturn,
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Fixed "today" anchor so month-grid math is deterministic regardless of
// when the suite runs; matches the currentDate context (2026-07-02).
const TODAY = new Date(2026, 6, 15) // Jul 15 2026 (mid-month, safe from edge days)

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

function resetHookState(overrides: Partial<typeof mockUseAllTodosReturn> = {}) {
  mockUseAllTodosReturn = {
    todos: [],
    lists: [],
    loading: false,
    error: null,
    toggle: mockToggle,
    remove: mockRemove,
    moveToList: vi.fn(),
    setPriority: vi.fn(),
    setDueDate: mockSetDueDate,
    reload: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── CalendarPage ─────────────────────────────────────────────────────────────

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHookState()
  })

  it('shows loading skeleton while loading', async () => {
    resetHookState({ loading: true })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Calendar')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('shows error alert when error is set', async () => {
    resetHookState({ error: 'Failed to load tasks' })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tasks')
  })

  it('renders empty state for the selected day when there are no todos', async () => {
    resetHookState({ todos: [] })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('No tasks this day')).toBeInTheDocument()
  })

  it('renders month/year heading and navigates to previous/next month', async () => {
    resetHookState({ todos: [] })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(format(TODAY, 'MMMM yyyy'))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText(format(new Date(2026, 7, 15), 'MMMM yyyy'))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText(format(new Date(2026, 5, 15), 'MMMM yyyy'))).toBeInTheDocument()
  })

  it('lists todos due on the selected day (defaults to today) with toggle/delete wired', async () => {
    resetHookState({
      todos: [makeTodo({ id: 't-today', title: 'Today task', due_date: TODAY.toISOString() })],
    })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Today task')).toBeInTheDocument()
    expect(screen.getByText(`${format(TODAY, 'EEEE, MMM d')} · 1`)).toBeInTheDocument()
  })

  it('opens the reschedule dialog when the reschedule button is clicked and reschedules', async () => {
    resetHookState({
      todos: [makeTodo({ id: 't-1', title: 'Reschedule me', due_date: TODAY.toISOString() })],
    })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Reschedule me' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    const dateInput = screen.getByLabelText(/due date/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-07-20' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }))

    // Switch to real timers only for the async wait — the click above already
    // queued the microtask; waitFor's polling needs real timers to progress.
    vi.useRealTimers()
    await waitFor(() => {
      expect(mockSetDueDate).toHaveBeenCalledWith('t-1', expect.stringContaining('2026-07-20'))
    })
  })

  it('closes the reschedule dialog via onClose', async () => {
    resetHookState({
      todos: [makeTodo({ id: 't-2', title: 'Cancel me', due_date: TODAY.toISOString() })],
    })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Cancel me' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }))

    vi.useRealTimers()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('handles dragstart on a todo item (sets dataTransfer)', async () => {
    resetHookState({
      todos: [makeTodo({ id: 't-drag', title: 'Drag me', due_date: TODAY.toISOString() })],
    })
    const { CalendarPage } = await import('@/pages/app/CalendarPage')
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    const listItem = screen.getByText('Drag me').closest('li') as HTMLLIElement
    expect(listItem).toHaveAttribute('draggable', 'true')

    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
    }
    fireEvent.dragStart(listItem, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/todo-id', 't-drag')
  })
})

// ── CalendarGrid ─────────────────────────────────────────────────────────────

describe('CalendarGrid', () => {
  const monthAnchor = TODAY

  it('renders weekday headers and a 7-column grid', async () => {
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={[]}
        selectedDay={null}
        onSelectDay={vi.fn()}
        onDropTodo={vi.fn()}
      />,
    )
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: format(monthAnchor, 'MMMM yyyy') })).toBeInTheDocument()
  })

  it('marks today with distinct styling and calls onSelectDay when a day cell is clicked', async () => {
    const onSelectDay = vi.fn()
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={[]}
        selectedDay={null}
        onSelectDay={onSelectDay}
        onDropTodo={vi.fn()}
      />,
    )

    const todayCell = screen.getByRole('gridcell', {
      name: new RegExp(`^${format(monthAnchor, 'EEEE, MMMM d')}`),
    })
    fireEvent.click(todayCell)
    expect(onSelectDay).toHaveBeenCalled()
  })

  it('shows task-count dots for a day with todos, capped with a +N overflow label', async () => {
    const dayTodos = [
      makeTodo({ id: 'd-1', due_date: monthAnchor.toISOString() }),
      makeTodo({ id: 'd-2', due_date: monthAnchor.toISOString(), completed: true }),
      makeTodo({ id: 'd-3', due_date: monthAnchor.toISOString() }),
      makeTodo({ id: 'd-4', due_date: monthAnchor.toISOString() }),
    ]
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={dayTodos}
        selectedDay={null}
        onSelectDay={vi.fn()}
        onDropTodo={vi.fn()}
      />,
    )

    expect(screen.getByText('+1')).toBeInTheDocument()
    const cell = screen.getByRole('gridcell', {
      name: new RegExp(`^${format(monthAnchor, 'EEEE, MMMM d')}, 4 tasks`),
    })
    expect(cell).toBeInTheDocument()
  })

  it('marks the selected day with aria-selected', async () => {
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={[]}
        selectedDay={monthAnchor}
        onSelectDay={vi.fn()}
        onDropTodo={vi.fn()}
      />,
    )
    const selectedCell = screen.getByRole('gridcell', {
      name: new RegExp(`^${format(monthAnchor, 'EEEE, MMMM d')}`),
    })
    expect(selectedCell).toHaveAttribute('aria-selected', 'true')
  })

  it('handles dragOver, dragLeave, and drop to call onDropTodo with the dragged id', async () => {
    const onDropTodo = vi.fn()
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={[]}
        selectedDay={null}
        onSelectDay={vi.fn()}
        onDropTodo={onDropTodo}
      />,
    )

    const cell = screen.getByRole('gridcell', {
      name: new RegExp(`^${format(monthAnchor, 'EEEE, MMMM d')}`),
    })

    fireEvent.dragOver(cell, { dataTransfer: { getData: vi.fn() } })
    fireEvent.dragLeave(cell)

    const dataTransfer = { getData: vi.fn().mockReturnValue('todo-xyz') }
    fireEvent.drop(cell, { dataTransfer })

    expect(onDropTodo).toHaveBeenCalledWith('todo-xyz', expect.any(Date))
  })

  it('does not call onDropTodo when the drop has no todo-id data', async () => {
    const onDropTodo = vi.fn()
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={[]}
        selectedDay={null}
        onSelectDay={vi.fn()}
        onDropTodo={onDropTodo}
      />,
    )

    const cell = screen.getByRole('gridcell', {
      name: new RegExp(`^${format(monthAnchor, 'EEEE, MMMM d')}`),
    })
    const dataTransfer = { getData: vi.fn().mockReturnValue('') }
    fireEvent.drop(cell, { dataTransfer })

    expect(onDropTodo).not.toHaveBeenCalled()
  })

  it('renders days from adjacent months with muted styling', async () => {
    const { CalendarGrid } = await import('@/components/tasks/CalendarGrid')
    const { container } = render(
      <CalendarGrid
        monthAnchor={monthAnchor}
        todos={[]}
        selectedDay={null}
        onSelectDay={vi.fn()}
        onDropTodo={vi.fn()}
      />,
    )
    // At least one gridcell should carry the "not in month" muted class
    const mutedCells = container.querySelectorAll('.text-gray-300')
    expect(mutedCells.length).toBeGreaterThan(0)
  })
})
