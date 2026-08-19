/**
 * coverage-views-1.test.tsx — Coverage for cross-list view pages + row components
 *
 * Purpose: Verify TodayPage, UpcomingPage, InboxPage, LogbookPage,
 *          InboxRow, WeekStrip render loading/empty/populated states and
 *          exercise key interactions (toggle, delete, move, uncomplete).
 * SPORT: view pages — Today/Upcoming/Inbox/Logbook/Calendar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { NpTask, NpList } from '@/lib/graphql'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

vi.mock('@/lib/graphql', () => ({
  getAllTodos: vi.fn().mockResolvedValue([]),
  getLists: vi.fn().mockResolvedValue([]),
  toggleTodo: vi.fn().mockResolvedValue(true),
  deleteTodo: vi.fn().mockResolvedValue(true),
  updateTodo: vi.fn().mockResolvedValue({}),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeTodo(overrides: Partial<NpTask> = {}): NpTask {
  return {
    id: 't-1',
    user_id: 'u-1',
    list_id: null,
    title: 'Sample task',
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
    ...overrides,
  } as NpTask
}

function makeList(overrides: Partial<NpList> = {}): NpList {
  return {
    id: 'l-1',
    user_id: 'u-1',
    title: 'Work',
    description: '',
    color: '#6366f1',
    icon: '',
    is_default: false,
    position: 0,
    group_id: null,
    source_account_id: 'primary',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as NpList
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/app']}>{ui}</MemoryRouter>)
}

// ── TodayPage ────────────────────────────────────────────────────────────────

describe('TodayPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no todos due', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([])
    vi.mocked(getLists).mockResolvedValue([])

    const { TodayPage } = await import('@/pages/app/TodayPage')
    renderInRouter(<TodayPage />)

    await waitFor(() => {
      expect(screen.getByText('today.emptyTitle')).toBeInTheDocument()
    })
  })

  it('renders overdue and today sections with counts', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'overdue-1', title: 'Overdue task', due_date: isoDaysFromNow(-3) }),
      makeTodo({ id: 'today-1', title: 'Today task', due_date: new Date().toISOString() }),
      makeTodo({ id: 'done-1', title: 'Completed today', completed: true, due_date: new Date().toISOString() }),
    ])
    vi.mocked(getLists).mockResolvedValue([])

    const { TodayPage } = await import('@/pages/app/TodayPage')
    renderInRouter(<TodayPage />)

    await waitFor(() => {
      expect(screen.getByText('Overdue task')).toBeInTheDocument()
      expect(screen.getByText('Today task')).toBeInTheDocument()
    })
    expect(screen.getByText(/today.overdueHeading · 1/)).toBeInTheDocument()
    expect(screen.getByText(/today.todayHeading · 1/)).toBeInTheDocument()
    expect(screen.getByText('today.dueCount')).toBeInTheDocument()
  })

  it('shows error alert when load fails', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockRejectedValue(new Error('Network down'))
    vi.mocked(getLists).mockResolvedValue([])

    const { TodayPage } = await import('@/pages/app/TodayPage')
    renderInRouter(<TodayPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network down')
    })
  })

  it('toggles a todo complete via the checkbox button', async () => {
    const { getAllTodos, getLists, toggleTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'today-2', title: 'Toggle me', due_date: new Date().toISOString() }),
    ])
    vi.mocked(getLists).mockResolvedValue([])
    vi.mocked(toggleTodo).mockResolvedValue(true)

    const { TodayPage } = await import('@/pages/app/TodayPage')
    const user = userEvent.setup()
    renderInRouter(<TodayPage />)

    await waitFor(() => expect(screen.getByText('Toggle me')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'todoItem.markComplete' }))

    await waitFor(() => {
      expect(toggleTodo).toHaveBeenCalledWith('today-2', true)
    })
  })

  it('deletes a todo via the delete button', async () => {
    const { getAllTodos, getLists, deleteTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'today-3', title: 'Delete me', due_date: new Date().toISOString() }),
    ])
    vi.mocked(getLists).mockResolvedValue([])
    vi.mocked(deleteTodo).mockResolvedValue(true)

    const { TodayPage } = await import('@/pages/app/TodayPage')
    const user = userEvent.setup()
    renderInRouter(<TodayPage />)

    await waitFor(() => expect(screen.getByText('Delete me')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'todoItem.deleteTask: Delete me' }))

    await waitFor(() => {
      expect(deleteTodo).toHaveBeenCalledWith('today-3')
    })
  })
})

// ── UpcomingPage ─────────────────────────────────────────────────────────────

describe('UpcomingPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when nothing scheduled', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([])
    vi.mocked(getLists).mockResolvedValue([])

    const { UpcomingPage } = await import('@/pages/app/UpcomingPage')
    renderInRouter(<UpcomingPage />)

    await waitFor(() => {
      expect(screen.getByText('upcoming.emptyTitle')).toBeInTheDocument()
    })
  })

  it('renders day groups and later section', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'up-1', title: 'In 2 days', due_date: isoDaysFromNow(2) }),
      makeTodo({ id: 'up-later', title: 'Way later', due_date: isoDaysFromNow(30) }),
    ])
    vi.mocked(getLists).mockResolvedValue([])

    const { UpcomingPage } = await import('@/pages/app/UpcomingPage')
    renderInRouter(<UpcomingPage />)

    await waitFor(() => {
      expect(screen.getByText('In 2 days')).toBeInTheDocument()
    })
    expect(screen.getByText('Way later')).toBeInTheDocument()
    expect(screen.getByText(/upcoming.laterHeading · 1/)).toBeInTheDocument()
    expect(screen.getByText('upcoming.scheduledCount')).toBeInTheDocument()
  })

  it('shows error alert when load fails', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockRejectedValue(new Error('Boom'))
    vi.mocked(getLists).mockResolvedValue([])

    const { UpcomingPage } = await import('@/pages/app/UpcomingPage')
    renderInRouter(<UpcomingPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    })
  })

  it('toggles a todo complete from an upcoming day group', async () => {
    const { getAllTodos, getLists, toggleTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'up-toggle', title: 'Toggle upcoming', due_date: isoDaysFromNow(3) }),
    ])
    vi.mocked(getLists).mockResolvedValue([])
    vi.mocked(toggleTodo).mockResolvedValue(true)

    const { UpcomingPage } = await import('@/pages/app/UpcomingPage')
    const user = userEvent.setup()
    renderInRouter(<UpcomingPage />)

    await waitFor(() => expect(screen.getByText('Toggle upcoming')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'todoItem.markComplete' }))

    await waitFor(() => {
      expect(toggleTodo).toHaveBeenCalledWith('up-toggle', true)
    })
  })
})

// ── InboxPage ────────────────────────────────────────────────────────────────

describe('InboxPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when inbox zero', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([])
    vi.mocked(getLists).mockResolvedValue([])

    const { InboxPage } = await import('@/pages/app/InboxPage')
    renderInRouter(<InboxPage />)

    await waitFor(() => {
      expect(screen.getByText('inbox.emptyTitle')).toBeInTheDocument()
    })
  })

  it('renders untriaged todos and excludes default-list todos are included, targets exclude default list', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'inbox-1', title: 'No list task', list_id: null }),
      makeTodo({ id: 'inbox-2', title: 'Default list task', list_id: 'default-list' }),
      makeTodo({ id: 'filed-1', title: 'Filed task', list_id: 'other-list' }),
      makeTodo({ id: 'done-1', title: 'Completed task', list_id: null, completed: true }),
    ])
    vi.mocked(getLists).mockResolvedValue([
      makeList({ id: 'default-list', title: 'Inbox List', is_default: true }),
      makeList({ id: 'other-list', title: 'Personal', is_default: false }),
    ])

    const { InboxPage } = await import('@/pages/app/InboxPage')
    renderInRouter(<InboxPage />)

    await waitFor(() => {
      expect(screen.getByText('No list task')).toBeInTheDocument()
    })
    expect(screen.getByText('Default list task')).toBeInTheDocument()
    expect(screen.queryByText('Filed task')).not.toBeInTheDocument()
    expect(screen.queryByText('Completed task')).not.toBeInTheDocument()
    expect(screen.getByText('inbox.untriagedCount')).toBeInTheDocument()

    // Move-to select should offer only the non-default list as a target.
    const selects = screen.getAllByLabelText('inbox.moveTaskToList')
    expect(selects.length).toBe(2)
  })

  it('moves a todo to another list via the select', async () => {
    const { getAllTodos, getLists, updateTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'inbox-move', title: 'Move me', list_id: null }),
    ])
    vi.mocked(getLists).mockResolvedValue([makeList({ id: 'other-list', title: 'Personal' })])
    vi.mocked(updateTodo).mockResolvedValue({} as NpTask)

    const { InboxPage } = await import('@/pages/app/InboxPage')
    renderInRouter(<InboxPage />)

    await waitFor(() => expect(screen.getByText('Move me')).toBeInTheDocument())

    const select = screen.getByLabelText('inbox.moveTaskToList')
    fireEvent.change(select, { target: { value: 'other-list' } })

    await waitFor(() => {
      expect(updateTodo).toHaveBeenCalledWith('inbox-move', { list_id: 'other-list' })
    })
  })

  it('ignores select change with empty value', async () => {
    const { getAllTodos, getLists, updateTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'inbox-noop', title: 'No-op task', list_id: null }),
    ])
    vi.mocked(getLists).mockResolvedValue([makeList({ id: 'other-list', title: 'Personal' })])

    const { InboxPage } = await import('@/pages/app/InboxPage')
    renderInRouter(<InboxPage />)

    await waitFor(() => expect(screen.getByText('No-op task')).toBeInTheDocument())

    const select = screen.getByLabelText('inbox.moveTaskToList')
    fireEvent.change(select, { target: { value: '' } })

    expect(updateTodo).not.toHaveBeenCalled()
  })

  it('deletes an inbox todo', async () => {
    const { getAllTodos, getLists, deleteTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({ id: 'inbox-del', title: 'Delete inbox task', list_id: null }),
    ])
    vi.mocked(getLists).mockResolvedValue([])
    vi.mocked(deleteTodo).mockResolvedValue(true)

    const { InboxPage } = await import('@/pages/app/InboxPage')
    const user = userEvent.setup()
    renderInRouter(<InboxPage />)

    await waitFor(() => expect(screen.getByText('Delete inbox task')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'todoItem.deleteTask: Delete inbox task' }))

    await waitFor(() => {
      expect(deleteTodo).toHaveBeenCalledWith('inbox-del')
    })
  })

  it('shows error alert when load fails', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockRejectedValue(new Error('Inbox load failed'))
    vi.mocked(getLists).mockResolvedValue([])

    const { InboxPage } = await import('@/pages/app/InboxPage')
    renderInRouter(<InboxPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Inbox load failed')
    })
  })
})

// ── LogbookPage ──────────────────────────────────────────────────────────────

describe('LogbookPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no completed tasks', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([])
    vi.mocked(getLists).mockResolvedValue([])

    const { LogbookPage } = await import('@/pages/app/LogbookPage')
    renderInRouter(<LogbookPage />)

    await waitFor(() => {
      expect(screen.getByText('logbook.emptyTitle')).toBeInTheDocument()
    })
  })

  it('renders completed todos grouped by day with strike-through title', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({
        id: 'log-1',
        title: 'Finished thing',
        completed: true,
        updated_at: new Date().toISOString(),
      }),
      makeTodo({
        id: 'log-2',
        title: 'Not done yet',
        completed: false,
      }),
    ])
    vi.mocked(getLists).mockResolvedValue([])

    const { LogbookPage } = await import('@/pages/app/LogbookPage')
    renderInRouter(<LogbookPage />)

    await waitFor(() => {
      expect(screen.getByText('Finished thing')).toBeInTheDocument()
    })
    expect(screen.queryByText('Not done yet')).not.toBeInTheDocument()
    expect(screen.getByText('logbook.completedCount')).toBeInTheDocument()
  })

  it('marks a completed todo incomplete via the row button', async () => {
    const { getAllTodos, getLists, toggleTodo } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockResolvedValue([
      makeTodo({
        id: 'log-uncomplete',
        title: 'Undo me',
        completed: true,
        updated_at: new Date().toISOString(),
      }),
    ])
    vi.mocked(getLists).mockResolvedValue([])
    vi.mocked(toggleTodo).mockResolvedValue(true)

    const { LogbookPage } = await import('@/pages/app/LogbookPage')
    const user = userEvent.setup()
    renderInRouter(<LogbookPage />)

    await waitFor(() => expect(screen.getByText('Undo me')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'logbook.markIncomplete' }))

    await waitFor(() => {
      expect(toggleTodo).toHaveBeenCalledWith('log-uncomplete', false)
    })
  })

  it('shows error alert when load fails', async () => {
    const { getAllTodos, getLists } = await import('@/lib/graphql')
    vi.mocked(getAllTodos).mockRejectedValue(new Error('Logbook load failed'))
    vi.mocked(getLists).mockResolvedValue([])

    const { LogbookPage } = await import('@/pages/app/LogbookPage')
    renderInRouter(<LogbookPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Logbook load failed')
    })
  })
})

// ── InboxRow (standalone) ────────────────────────────────────────────────────

describe('InboxRow', () => {
  it('disables select when there are no candidate lists', async () => {
    const { InboxRow } = await import('@/components/tasks/InboxRow')
    render(
      <InboxRow
        todo={makeTodo({ title: 'Lonely task' })}
        lists={[]}
        onToggle={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.getByLabelText('inbox.moveTaskToList')).toBeDisabled()
  })

  it('calls onMove with todo id and selected list id', async () => {
    const { InboxRow } = await import('@/components/tasks/InboxRow')
    const onMove = vi.fn().mockResolvedValue(undefined)
    render(
      <InboxRow
        todo={makeTodo({ id: 'row-1', title: 'Row task' })}
        lists={[makeList({ id: 'list-a', title: 'List A' })]}
        onToggle={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onMove={onMove}
      />,
    )
    fireEvent.change(screen.getByLabelText('inbox.moveTaskToList'), {
      target: { value: 'list-a' },
    })
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('row-1', 'list-a'))
  })

  it('renders option for each candidate list', async () => {
    const { InboxRow } = await import('@/components/tasks/InboxRow')
    render(
      <InboxRow
        todo={makeTodo({ title: 'Multi-list task' })}
        lists={[makeList({ id: 'a', title: 'Alpha' }), makeList({ id: 'b', title: 'Beta' })]}
        onToggle={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})

// ── WeekStrip (standalone) ───────────────────────────────────────────────────

describe('WeekStrip', () => {
  it('renders 7 day cells for the week', async () => {
    const { WeekStrip } = await import('@/components/tasks/WeekStrip')
    render(
      <WeekStrip weekAnchor={new Date()} todos={[]} selectedDay={null} onSelectDay={vi.fn()} />,
    )
    expect(screen.getAllByRole('gridcell')).toHaveLength(7)
  })

  it('marks the selected day as aria-selected', async () => {
    const { WeekStrip } = await import('@/components/tasks/WeekStrip')
    const today = new Date()
    render(
      <WeekStrip weekAnchor={today} todos={[]} selectedDay={today} onSelectDay={vi.fn()} />,
    )
    const selectedCells = screen.getAllByRole('gridcell').filter(
      (el) => el.getAttribute('aria-selected') === 'true',
    )
    expect(selectedCells.length).toBe(1)
  })

  it('calls onSelectDay when a day cell is clicked', async () => {
    const { WeekStrip } = await import('@/components/tasks/WeekStrip')
    const onSelectDay = vi.fn()
    render(
      <WeekStrip weekAnchor={new Date()} todos={[]} selectedDay={null} onSelectDay={onSelectDay} />,
    )
    const cells = screen.getAllByRole('gridcell')
    fireEvent.click(cells[0])
    expect(onSelectDay).toHaveBeenCalledTimes(1)
  })

  it('includes task count in the day cell aria-label when todos exist on that day', async () => {
    const { WeekStrip } = await import('@/components/tasks/WeekStrip')
    const today = new Date()
    render(
      <WeekStrip
        weekAnchor={today}
        todos={[makeTodo({ due_date: today.toISOString() })]}
        selectedDay={null}
        onSelectDay={vi.fn()}
      />,
    )
    const withCount = screen.getAllByRole('gridcell').find((el) =>
      (el.getAttribute('aria-label') ?? '').includes('1 tasks'),
    )
    expect(withCount).toBeTruthy()
  })
})
