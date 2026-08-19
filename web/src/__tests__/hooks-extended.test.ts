/**
 * hooks-extended.test.ts — Tests for useFilterSort, useSearch, useListPermission,
 *                          useSubscription, useScreenState
 *
 * Purpose: Verify hook logic: URL sync, debounce, permission derivation, WS lifecycle.
 * Uses renderHook from @testing-library/react.
 * SPORT: D2-S7-T2, D-S5-T1, D2-S1-T1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/graphql', () => ({
  searchTodos: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/graphql-collab', () => ({
  getListMembers: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
  }),
}))

vi.mock('@/lib/graphql-ws-client', () => ({
  getWsClient: vi.fn().mockReturnValue({
    subscribe: vi.fn().mockReturnValue(() => {}),
  }),
}))

// ── useFilterSort ─────────────────────────────────────────────────────────────

describe('useFilterSort', () => {
  beforeEach(() => {
    // Reset URL
    window.history.replaceState(null, '', '/')
  })

  it('returns default filters when URL has no params', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    expect(result.current.filters.status).toBe('all')
    expect(result.current.filters.priority).toBe('')
    expect(result.current.filters.tagIds).toEqual([])
    expect(result.current.filters.dueRange).toBe('all')
  })

  it('returns default sort when URL has no params', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    expect(result.current.sort.field).toBe('created_at')
    expect(result.current.sort.direction).toBe('desc')
  })

  it('setFilter updates filter state', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    act(() => {
      result.current.setFilter('status', 'active')
    })

    expect(result.current.filters.status).toBe('active')
  })

  it('setFilter updates priority', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    act(() => {
      result.current.setFilter('priority', 'high')
    })

    expect(result.current.filters.priority).toBe('high')
  })

  it('setFilter updates tagIds', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    act(() => {
      result.current.setFilter('tagIds', ['tag-1', 'tag-2'])
    })

    expect(result.current.filters.tagIds).toEqual(['tag-1', 'tag-2'])
  })

  it('setSort updates sort field and direction', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    act(() => {
      result.current.setSort({ field: 'due_date', direction: 'asc' })
    })

    expect(result.current.sort.field).toBe('due_date')
    expect(result.current.sort.direction).toBe('asc')
  })

  it('clearAll resets filters and sort to defaults', async () => {
    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    act(() => {
      result.current.setFilter('status', 'completed')
      result.current.setSort({ field: 'title', direction: 'asc' })
    })

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.filters.status).toBe('all')
    expect(result.current.sort.field).toBe('created_at')
    expect(result.current.sort.direction).toBe('desc')
  })

  it('reads initial values from URL params', async () => {
    window.history.replaceState(null, '', '/?status=completed&priority=high&due=today&sortField=title&sortDir=asc')

    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    expect(result.current.filters.status).toBe('completed')
    expect(result.current.filters.priority).toBe('high')
    expect(result.current.filters.dueRange).toBe('today')
    expect(result.current.sort.field).toBe('title')
    expect(result.current.sort.direction).toBe('asc')
  })

  it('handles tagIds from URL params', async () => {
    window.history.replaceState(null, '', '/?tags=tag-1,tag-2')

    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    expect(result.current.filters.tagIds).toEqual(['tag-1', 'tag-2'])
  })

  it('RTL direction does not break URL sync', async () => {
    document.documentElement.setAttribute('dir', 'rtl')
    window.history.replaceState(null, '', '/?status=active')

    const { useFilterSort } = await import('@/hooks/useFilterSort')
    const { result } = renderHook(() => useFilterSort())

    expect(result.current.filters.status).toBe('active')

    document.documentElement.setAttribute('dir', 'ltr')
  })
})

// ── useSearch ────────────────────────────────────────────────────────────────

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty results and no loading for short query', async () => {
    const { useSearch } = await import('@/hooks/useSearch')
    const { result } = renderHook(() => useSearch('a'))

    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('returns empty results for empty query', async () => {
    const { useSearch } = await import('@/hooks/useSearch')
    const { result } = renderHook(() => useSearch(''))

    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('sets loading=true while debouncing', async () => {
    const { searchTodos } = await import('@/lib/graphql')
    const mock = searchTodos as ReturnType<typeof vi.fn>
    mock.mockResolvedValue([{ id: 't-1', title: 'Task', list_id: 'l-1', completed: false, priority: 'none', due_date: null, position: 0, source_account_id: 'primary', created_at: '', updated_at: '' }])

    const { useSearch } = await import('@/hooks/useSearch')
    const { result } = renderHook(() => useSearch('search query'))

    // After render, loading should be true (debounce timer running)
    expect(result.current.loading).toBe(true)
  })

  it('resolves results after debounce fires', async () => {
    const { searchTodos } = await import('@/lib/graphql')
    const mock = searchTodos as ReturnType<typeof vi.fn>
    const taskResult = { id: 't-1', title: 'Found task', list_id: 'l-1', completed: false, priority: 'none', due_date: null, position: 0, source_account_id: 'primary', created_at: '', updated_at: '' }
    mock.mockResolvedValue([taskResult])

    const { useSearch } = await import('@/hooks/useSearch')
    const { result } = renderHook(() => useSearch('found'))

    // Drain the debounce timer and the async searchTodos promise
    await act(async () => {
      await vi.runAllTimersAsync()
      // flush any remaining microtasks from the resolved promise
      await Promise.resolve()
    })

    expect(result.current.loading).toBe(false)
    expect(mock).toHaveBeenCalledWith('found')
  })

  it('sets error=true when searchTodos throws', async () => {
    const { searchTodos } = await import('@/lib/graphql')
    const mock = searchTodos as ReturnType<typeof vi.fn>
    mock.mockRejectedValue(new Error('Network error'))

    const { useSearch } = await import('@/hooks/useSearch')
    const { result } = renderHook(() => useSearch('throw error'))

    // Drain the debounce timer and the rejected promise
    await act(async () => {
      await vi.runAllTimersAsync()
      // flush any remaining microtasks from the rejected promise
      await Promise.resolve()
    })

    expect(result.current.error).toBe(true)
    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})

// ── useListPermission ────────────────────────────────────────────────────────

describe('useListPermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns role=null when no members found for current user', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    const mock = getListMembers as ReturnType<typeof vi.fn>
    mock.mockResolvedValue([
      { id: 'm-1', list_id: 'list-1', user_id: 'other-user', role: 'owner', invited_by: null, joined_at: '' },
    ])

    const { useListPermission } = await import('@/hooks/useListPermission')
    const { result } = renderHook(() => useListPermission('list-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBeNull()
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canManageMembers).toBe(false)
  })

  it('returns canEdit=true when user is owner', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    const mock = getListMembers as ReturnType<typeof vi.fn>
    mock.mockResolvedValue([
      { id: 'm-1', list_id: 'list-1', user_id: 'user-1', role: 'owner', invited_by: null, joined_at: '' },
    ])

    const { useListPermission } = await import('@/hooks/useListPermission')
    const { result } = renderHook(() => useListPermission('list-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe('owner')
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canManageMembers).toBe(true)
  })

  it('returns canEdit=true and canManageMembers=false when user is editor', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    const mock = getListMembers as ReturnType<typeof vi.fn>
    mock.mockResolvedValue([
      { id: 'm-1', list_id: 'list-1', user_id: 'user-1', role: 'editor', invited_by: null, joined_at: '' },
    ])

    const { useListPermission } = await import('@/hooks/useListPermission')
    const { result } = renderHook(() => useListPermission('list-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBe('editor')
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canManageMembers).toBe(false)
  })

  it('returns canEdit=false when user is viewer', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    const mock = getListMembers as ReturnType<typeof vi.fn>
    mock.mockResolvedValue([
      { id: 'm-1', list_id: 'list-1', user_id: 'user-1', role: 'viewer', invited_by: null, joined_at: '' },
    ])

    const { useListPermission } = await import('@/hooks/useListPermission')
    const { result } = renderHook(() => useListPermission('list-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.canEdit).toBe(false)
    expect(result.current.canManageMembers).toBe(false)
  })

  it('returns loading=false when user is null', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    const listMock = getListMembers as ReturnType<typeof vi.fn>
    listMock.mockResolvedValue([])

    const { useAuth } = await import('@/lib/auth-context')
    const mockUseAuth = useAuth as ReturnType<typeof vi.fn>
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    const { useListPermission } = await import('@/hooks/useListPermission')
    const { result } = renderHook(() => useListPermission('list-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.role).toBeNull()
  })
})

// ── useSubscription ──────────────────────────────────────────────────────────

describe('useSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns loading=false when disabled', async () => {
    const { useSubscription } = await import('@/hooks/useSubscription')
    const { result } = renderHook(() =>
      useSubscription('subscription { foo }', {}, { enabled: false })
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('calls getWsClient.subscribe when enabled', async () => {
    const { getWsClient } = await import('@/lib/graphql-ws-client')
    const mockGetWsClient = getWsClient as ReturnType<typeof vi.fn>
    const mockSubscribe = vi.fn().mockReturnValue(() => {})
    mockGetWsClient.mockReturnValue({ subscribe: mockSubscribe })

    const { useSubscription } = await import('@/hooks/useSubscription')
    renderHook(() =>
      useSubscription('subscription { foo }', { listId: 'list-1' }, { enabled: true })
    )

    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('starts with loading=true when enabled', async () => {
    const { getWsClient } = await import('@/lib/graphql-ws-client')
    const mockGetWsClient = getWsClient as ReturnType<typeof vi.fn>
    const mockSubscribe = vi.fn().mockReturnValue(() => {})
    mockGetWsClient.mockReturnValue({ subscribe: mockSubscribe })

    const { useSubscription } = await import('@/hooks/useSubscription')
    const { result } = renderHook(() =>
      useSubscription('subscription { bar }', {})
    )

    expect(result.current.loading).toBe(true)
  })

  it('handles subscription error gracefully', async () => {
    const { getWsClient } = await import('@/lib/graphql-ws-client')
    const mockGetWsClient = getWsClient as ReturnType<typeof vi.fn>
    mockGetWsClient.mockImplementation(() => {
      throw new Error('WS unavailable')
    })

    const { useSubscription } = await import('@/hooks/useSubscription')
    const { result } = renderHook(() =>
      useSubscription('subscription { err }', {})
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('WS unavailable')
    })
  })

  it('sets data when next callback is fired', async () => {
    const { getWsClient } = await import('@/lib/graphql-ws-client')
    const mockGetWsClient = getWsClient as ReturnType<typeof vi.fn>

    let capturedNext: ((value: { data?: unknown }) => void) | null = null

    const mockSubscribe = vi.fn().mockImplementation(
      (_params: unknown, handlers: { next: (value: { data?: unknown }) => void }) => {
        capturedNext = handlers.next
        return () => {}
      }
    )
    mockGetWsClient.mockReturnValue({ subscribe: mockSubscribe })

    const { useSubscription } = await import('@/hooks/useSubscription')
    const { result } = renderHook(() =>
      useSubscription<{ foo: string }>('subscription { foo }', {})
    )

    // Fire the next handler with data
    await act(async () => {
      capturedNext?.({ data: { foo: 'bar' } })
    })

    await waitFor(() => {
      expect(result.current.data).toEqual({ foo: 'bar' })
      expect(result.current.loading).toBe(false)
    })
  })
})

// ── useScreenState ────────────────────────────────────────────────────────────

describe('useScreenState', () => {
  it('returns loading state when loading=true and no data', async () => {
    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: true, data: null })
    )
    expect(result.current.state).toBe('loading')
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isEmpty).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('returns empty state when loading=false and data is empty array', async () => {
    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: [] })
    )
    expect(result.current.state).toBe('empty')
    expect(result.current.isEmpty).toBe(true)
  })

  it('returns content state when data has items', async () => {
    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: [{ id: '1' }] })
    )
    expect(result.current.state).toBe('content')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isEmpty).toBe(false)
  })

  it('returns error state when error is provided', async () => {
    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: null, error: 'Something went wrong' })
    )
    expect(result.current.state).toBe('error')
    expect(result.current.isError).toBe(true)
  })

  it('returns permission state when isPermissionError=true', async () => {
    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: null, isPermissionError: true })
    )
    expect(result.current.state).toBe('permission')
    expect(result.current.isError).toBe(true)
  })

  it('returns rate-limit state when isRateLimitError=true', async () => {
    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: null, isRateLimitError: true })
    )
    expect(result.current.state).toBe('rate-limit')
    expect(result.current.isError).toBe(true)
  })

  it('still works correctly in RTL locale context', async () => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'ar')

    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: [{ id: 'item-1' }] })
    )

    expect(result.current.state).toBe('content')
    expect(document.documentElement.dir).toBe('rtl')

    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', 'en')
  })

  it('returns offline state when navigator.onLine is false and no data', async () => {
    // Save original
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine')

    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })

    const { useScreenState } = await import('@/hooks/useScreenState')
    const { result } = renderHook(() =>
      useScreenState({ loading: false, data: null })
    )

    expect(result.current.state).toBe('offline')
    expect(result.current.isOffline).toBe(true)

    // Restore
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'onLine', originalDescriptor)
    } else {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
    }
  })
})
