/**
 * task-components.test.tsx — RTL render tests for task UI components
 *
 * Purpose: Cover CommentThread, SubtaskList, TagFilter, FilterSortPanel,
 *          SearchBar, RecurrenceSelector with mock GraphQL deps.
 * SPORT: D2-S2, D2-S4, D2-S7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── Global mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

vi.mock('@/lib/graphql', () => ({
  getComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn().mockResolvedValue(null),
  updateComment: vi.fn().mockResolvedValue(null),
  deleteComment: vi.fn().mockResolvedValue(true),
  getSubtasks: vi.fn().mockResolvedValue([]),
  createSubtask: vi.fn().mockResolvedValue(null),
  toggleSubtask: vi.fn().mockResolvedValue(true),
  deleteSubtask: vi.fn().mockResolvedValue(true),
  getTags: vi.fn().mockResolvedValue([]),
  searchTodos: vi.fn().mockResolvedValue([]),
  createRecurringRule: vi.fn().mockResolvedValue(null),
  updateRecurringRule: vi.fn().mockResolvedValue(null),
  deleteRecurringRule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/hooks/useScreenState', () => ({
  useScreenState: ({ loading, data, error }: { loading: boolean; data: unknown; error?: unknown }) => ({
    state: loading ? 'loading' : error ? 'error' : (!data || (Array.isArray(data) && data.length === 0)) ? 'empty' : 'content',
    isLoading: loading,
    isEmpty: !loading && !error && (!data || (Array.isArray(data) && data.length === 0)),
    isError: !!error,
    isOffline: false,
  }),
}))

// ── CommentThread ─────────────────────────────────────────────────────────────

describe('CommentThread', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders comment form', async () => {
    const { CommentThread } = await import('@/components/tasks/CommentThread')
    render(<CommentThread todoId="todo-1" />)
    await waitFor(() => {
      expect(screen.getByRole('form', { name: 'comments.add' })).toBeInTheDocument()
    })
  })

  it('renders empty state when no comments', async () => {
    const { getComments } = await import('@/lib/graphql')
    const mock = getComments as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { CommentThread } = await import('@/components/tasks/CommentThread')
    render(<CommentThread todoId="todo-1" />)

    await waitFor(() => {
      expect(screen.getByText('comments.empty')).toBeInTheDocument()
    })
  })

  it('renders comments when loaded', async () => {
    const { getComments } = await import('@/lib/graphql')
    const mock = getComments as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      {
        id: 'c-1', todo_id: 'todo-1', author_id: 'user-1', body: 'Test comment',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
      },
    ])

    const { CommentThread } = await import('@/components/tasks/CommentThread')
    render(<CommentThread todoId="todo-1" />)

    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument()
    })
  })

  it('renders title heading', async () => {
    const { getComments } = await import('@/lib/graphql')
    const mock = getComments as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { CommentThread } = await import('@/components/tasks/CommentThread')
    render(<CommentThread todoId="todo-1" />)

    expect(screen.getByText('comments.title')).toBeInTheDocument()
  })

  it('add button is disabled when text is empty', async () => {
    const { CommentThread } = await import('@/components/tasks/CommentThread')
    render(<CommentThread todoId="todo-1" />)

    await waitFor(() => {
      const addBtn = screen.getByRole('button', { name: 'comments.add' })
      expect(addBtn).toBeDisabled()
    })
  })

  it('calls createComment on form submit', async () => {
    const { getComments, createComment } = await import('@/lib/graphql')
    const getCommentsMock = getComments as ReturnType<typeof vi.fn>
    const createCommentMock = createComment as ReturnType<typeof vi.fn>
    getCommentsMock.mockResolvedValueOnce([])
    createCommentMock.mockResolvedValueOnce({
      id: 'c-new', todo_id: 'todo-1', author_id: 'u-1', body: 'New comment',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    })

    const { CommentThread } = await import('@/components/tasks/CommentThread')
    const user = userEvent.setup()
    render(<CommentThread todoId="todo-1" />)

    await waitFor(() => {
      expect(screen.getByText('comments.empty')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('comments.placeholder')
    await user.type(textarea, 'New comment')

    const addBtn = screen.getByRole('button', { name: 'comments.add' })
    await user.click(addBtn)

    await waitFor(() => {
      expect(createCommentMock).toHaveBeenCalled()
    })
  })
})

// ── SubtaskList ───────────────────────────────────────────────────────────────

describe('SubtaskList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders expand toggle button', async () => {
    const { SubtaskList } = await import('@/components/tasks/SubtaskList')
    render(<SubtaskList todoId="todo-1" />)
    expect(screen.getByRole('button', { name: /subtasks\.title/i })).toBeInTheDocument()
  })

  it('does not show content when collapsed', async () => {
    const { SubtaskList } = await import('@/components/tasks/SubtaskList')
    render(<SubtaskList todoId="todo-1" />)
    expect(screen.queryByPlaceholderText('subtasks.placeholder')).not.toBeInTheDocument()
  })

  it('shows subtask input after expanding', async () => {
    const { getSubtasks } = await import('@/lib/graphql')
    const mock = getSubtasks as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { SubtaskList } = await import('@/components/tasks/SubtaskList')
    const user = userEvent.setup()
    render(<SubtaskList todoId="todo-1" />)

    await user.click(screen.getByRole('button', { name: /subtasks\.title/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('subtasks.placeholder')).toBeInTheDocument()
    })
  })

  it('renders subtasks when expanded and loaded', async () => {
    const { getSubtasks } = await import('@/lib/graphql')
    const mock = getSubtasks as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      { id: 's-1', todo_id: 'todo-1', title: 'Step one', is_done: false, position: 0, created_at: '', updated_at: '' },
    ])

    const { SubtaskList } = await import('@/components/tasks/SubtaskList')
    const user = userEvent.setup()
    render(<SubtaskList todoId="todo-1" />)

    await user.click(screen.getByRole('button', { name: /subtasks\.title/i }))

    await waitFor(() => {
      expect(screen.getByText('Step one')).toBeInTheDocument()
    })
  })

  it('shows progress bar when subtasks exist', async () => {
    const { getSubtasks } = await import('@/lib/graphql')
    const mock = getSubtasks as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      { id: 's-1', todo_id: 'todo-1', title: 'Step one', is_done: true, position: 0, created_at: '', updated_at: '' },
      { id: 's-2', todo_id: 'todo-1', title: 'Step two', is_done: false, position: 1, created_at: '', updated_at: '' },
    ])

    const { SubtaskList } = await import('@/components/tasks/SubtaskList')
    const user = userEvent.setup()
    render(<SubtaskList todoId="todo-1" />)

    await user.click(screen.getByRole('button', { name: /subtasks\.title/i }))

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })
})

// ── TagFilter ─────────────────────────────────────────────────────────────────

describe('TagFilter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders null when no tags', async () => {
    const { getTags } = await import('@/lib/graphql')
    const mock = getTags as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { TagFilter } = await import('@/components/tasks/TagFilter')
    const { container } = render(<TagFilter selectedTagIds={[]} onTagToggle={vi.fn()} />)

    await waitFor(() => {
      // Still loading initially, then returns null when no tags
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders tag chips when tags are available', async () => {
    const { getTags } = await import('@/lib/graphql')
    const mock = getTags as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      { id: 'tag-1', name: 'Bug', color: '#f00', user_id: 'u-1', created_at: '' },
      { id: 'tag-2', name: 'Feature', color: '#0f0', user_id: 'u-1', created_at: '' },
    ])

    const { TagFilter } = await import('@/components/tasks/TagFilter')
    render(<TagFilter selectedTagIds={[]} onTagToggle={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument()
      expect(screen.getByText('Feature')).toBeInTheDocument()
    })
  })

  it('calls onTagToggle when a tag chip is clicked', async () => {
    const { getTags } = await import('@/lib/graphql')
    const mock = getTags as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      { id: 'tag-1', name: 'Bug', color: '#f00', user_id: 'u-1', created_at: '' },
    ])

    const onTagToggle = vi.fn()
    const { TagFilter } = await import('@/components/tasks/TagFilter')
    const user = userEvent.setup()
    render(<TagFilter selectedTagIds={[]} onTagToggle={onTagToggle} />)

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Bug'))
    expect(onTagToggle).toHaveBeenCalledWith('tag-1')
  })

  it('shows Clear button when tags are selected', async () => {
    const { getTags } = await import('@/lib/graphql')
    const mock = getTags as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      { id: 'tag-1', name: 'Bug', color: '#f00', user_id: 'u-1', created_at: '' },
    ])

    const { TagFilter } = await import('@/components/tasks/TagFilter')
    render(<TagFilter selectedTagIds={['tag-1']} onTagToggle={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear tag filters' })).toBeInTheDocument()
    })
  })
})

// ── FilterSortPanel ───────────────────────────────────────────────────────────

describe('FilterSortPanel', () => {
  const defaultFilter = { status: 'all' as const, priority: 'all' as const, tagIds: [] }
  const defaultSort = { field: 'created_at' as const, direction: 'desc' as const }

  it('renders filter panel dialog', async () => {
    const { FilterSortPanel } = await import('@/components/tasks/FilterSortPanel')
    render(
      <MemoryRouter>
        <FilterSortPanel
          filter={defaultFilter}
          sort={defaultSort}
          onFilterChange={vi.fn()}
          onSortChange={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders status radio group', async () => {
    const { FilterSortPanel } = await import('@/components/tasks/FilterSortPanel')
    render(
      <MemoryRouter>
        <FilterSortPanel
          filter={defaultFilter}
          sort={defaultSort}
          onFilterChange={vi.fn()}
          onSortChange={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole('radiogroup', { name: 'status' })).toBeInTheDocument()
  })

  it('calls onFilterChange when status is changed', async () => {
    const { FilterSortPanel } = await import('@/components/tasks/FilterSortPanel')
    const onFilterChange = vi.fn()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <FilterSortPanel
          filter={defaultFilter}
          sort={defaultSort}
          onFilterChange={onFilterChange}
          onSortChange={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )

    // Click "active" radio — it's a hidden input with a label
    const activeLabel = screen.getByText('filter.active')
    await user.click(activeLabel)

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
  })

  it('renders close button', async () => {
    const { FilterSortPanel } = await import('@/components/tasks/FilterSortPanel')
    render(
      <MemoryRouter>
        <FilterSortPanel
          filter={defaultFilter}
          sort={defaultSort}
          onFilterChange={vi.fn()}
          onSortChange={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: 'Close filter panel' })).toBeInTheDocument()
  })

  it('shows clear button when filter is dirty', async () => {
    const { FilterSortPanel } = await import('@/components/tasks/FilterSortPanel')
    render(
      <MemoryRouter>
        <FilterSortPanel
          filter={{ ...defaultFilter, status: 'active' }}
          sort={defaultSort}
          onFilterChange={vi.fn()}
          onSortChange={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('filter.clearAll')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const { FilterSortPanel } = await import('@/components/tasks/FilterSortPanel')
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <FilterSortPanel
          filter={defaultFilter}
          sort={defaultSort}
          onFilterChange={vi.fn()}
          onSortChange={vi.fn()}
          onClose={onClose}
        />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Close filter panel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ── SearchBar ──────────────────────────────────────────────────────────────────

describe('SearchBar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders search input', async () => {
    const { SearchBar } = await import('@/components/tasks/SearchBar')
    render(<SearchBar onResults={vi.fn()} />)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('shows clear button when query is non-empty', async () => {
    const { SearchBar } = await import('@/components/tasks/SearchBar')
    const user = userEvent.setup()
    render(<SearchBar onResults={vi.fn()} />)

    await user.type(screen.getByRole('searchbox'), 'test')
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
  })

  it('calls onQueryChange when text is typed', async () => {
    const { SearchBar } = await import('@/components/tasks/SearchBar')
    const onQueryChange = vi.fn()
    const user = userEvent.setup()

    render(<SearchBar onResults={vi.fn()} onQueryChange={onQueryChange} />)
    await user.type(screen.getByRole('searchbox'), 'a')

    expect(onQueryChange).toHaveBeenCalledWith('a')
  })

  it('clears input when clear button is clicked', async () => {
    const { SearchBar } = await import('@/components/tasks/SearchBar')
    const onResults = vi.fn()
    const user = userEvent.setup()

    render(<SearchBar onResults={onResults} />)

    await user.type(screen.getByRole('searchbox'), 'test')
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    expect(onResults).toHaveBeenCalledWith([])
  })

  it('respects initialQuery prop', async () => {
    const { SearchBar } = await import('@/components/tasks/SearchBar')
    render(<SearchBar onResults={vi.fn()} initialQuery="initial query" />)
    expect(screen.getByRole('searchbox')).toHaveValue('initial query')
  })
})

// ── RecurrenceSelector ────────────────────────────────────────────────────────

describe('RecurrenceSelector', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders recurrence toggle button', async () => {
    const { RecurrenceSelector } = await import('@/components/tasks/RecurrenceSelector')
    render(<RecurrenceSelector todoId="todo-1" rule={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'recurrence.title' })).toBeInTheDocument()
  })

  it('shows "recurrence.none" summary when no rule', async () => {
    const { RecurrenceSelector } = await import('@/components/tasks/RecurrenceSelector')
    render(<RecurrenceSelector todoId="todo-1" rule={null} onChange={vi.fn()} />)
    expect(screen.getByText('recurrence.none')).toBeInTheDocument()
  })

  it('opens dropdown when toggle is clicked', async () => {
    const { RecurrenceSelector } = await import('@/components/tasks/RecurrenceSelector')
    const user = userEvent.setup()
    render(<RecurrenceSelector todoId="todo-1" rule={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'recurrence.title' }))

    // Frequency select should appear
    expect(screen.getByRole('combobox', { name: 'recurrence.title' })).toBeInTheDocument()
  })

  it('shows existing rule frequency when rule is provided', async () => {
    const existingRule = {
      id: 'r-1', todo_id: 'todo-1', frequency: 'weekly', interval_count: 1,
      days_of_week: null, created_at: '', updated_at: '',
    }
    const { RecurrenceSelector } = await import('@/components/tasks/RecurrenceSelector')
    render(<RecurrenceSelector todoId="todo-1" rule={existingRule} onChange={vi.fn()} />)

    // Should show summary using t() which returns key: 'recurrence.weekly'
    expect(screen.getByText('recurrence.weekly')).toBeInTheDocument()
  })

  it('calls createRecurringRule when saving a new rule', async () => {
    const { createRecurringRule } = await import('@/lib/graphql')
    const createMock = createRecurringRule as ReturnType<typeof vi.fn>
    createMock.mockResolvedValueOnce({
      id: 'r-new', todo_id: 'todo-1', frequency: 'daily', interval_count: 1,
      days_of_week: null, created_at: '', updated_at: '',
    })

    const { RecurrenceSelector } = await import('@/components/tasks/RecurrenceSelector')
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RecurrenceSelector todoId="todo-1" rule={null} onChange={onChange} />)

    // Open dropdown
    await user.click(screen.getByRole('button', { name: 'recurrence.title' }))

    // Change frequency to daily
    const select = screen.getByRole('combobox', { name: 'recurrence.title' })
    await user.selectOptions(select, 'daily')

    // Click Save
    await user.click(screen.getByText('recurrence.save'))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'daily', todo_id: 'todo-1' }))
    })
  })
})
