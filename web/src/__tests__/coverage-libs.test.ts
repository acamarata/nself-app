/**
 * coverage-libs.test.ts — Coverage tests for near-0% pure-logic lib modules.
 *
 * Purpose: Exercise task-date-groups, markdown-lite, notifications, and
 *          graphql-ws-client with exhaustive branch coverage.
 * SPORT: view pages (Today/Upcoming/Logbook/Calendar) + D2-S7 notes UX +
 *        F02-COMMAND-INVENTORY send_notification + D-S5-T1 WS client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NpTask } from '@nself/ntask-core'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockIsTauri = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@/lib/tauri', () => ({
  isTauri: (...args: unknown[]) => mockIsTauri(...args),
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<NpTask> = {}): NpTask {
  return {
    id: 'task-1',
    user_id: 'user-1',
    list_id: null,
    title: 'Test task',
    description: '',
    completed: false,
    is_public: false,
    priority: 'none' as NpTask['priority'],
    notes: '',
    due_date: null,
    position: 0,
    source_account_id: 'primary',
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    requires_approval: false,
    requires_photo: false,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    ...overrides,
  }
}

// ── task-date-groups.ts ───────────────────────────────────────────────────────

describe('task-date-groups', () => {
  const NOW = new Date('2026-06-15T12:00:00.000Z')

  describe('parseDueDate', () => {
    it('returns null for null input', async () => {
      const { parseDueDate } = await import('@/lib/task-date-groups')
      expect(parseDueDate(null)).toBeNull()
    })

    it('returns null for invalid date string', async () => {
      const { parseDueDate } = await import('@/lib/task-date-groups')
      expect(parseDueDate('not-a-date')).toBeNull()
    })

    it('returns a Date for a valid ISO string', async () => {
      const { parseDueDate } = await import('@/lib/task-date-groups')
      const result = parseDueDate('2026-06-15T12:00:00.000Z')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result?.getTime())).toBe(false)
    })
  })

  describe('getOverdueTodos', () => {
    it('excludes completed todos even if overdue', async () => {
      const { getOverdueTodos } = await import('@/lib/task-date-groups')
      const todos = [makeTask({ completed: true, due_date: '2026-06-01T12:00:00.000Z' })]
      expect(getOverdueTodos(todos, NOW)).toEqual([])
    })

    it('excludes todos with no due date', async () => {
      const { getOverdueTodos } = await import('@/lib/task-date-groups')
      const todos = [makeTask({ due_date: null })]
      expect(getOverdueTodos(todos, NOW)).toEqual([])
    })

    it('includes incomplete todos due before today', async () => {
      const { getOverdueTodos } = await import('@/lib/task-date-groups')
      const overdue = makeTask({ id: 'a', due_date: '2026-06-01T12:00:00.000Z' })
      const future = makeTask({ id: 'b', due_date: '2026-06-20T12:00:00.000Z' })
      expect(getOverdueTodos([overdue, future], NOW)).toEqual([overdue])
    })
  })

  describe('getTodayTodos', () => {
    it('includes todos due today regardless of time', async () => {
      const { getTodayTodos } = await import('@/lib/task-date-groups')
      const todayTask = makeTask({ id: 'a', due_date: '2026-06-15T20:00:00.000Z' })
      expect(getTodayTodos([todayTask], NOW)).toEqual([todayTask])
    })

    it('excludes completed and non-today todos', async () => {
      const { getTodayTodos } = await import('@/lib/task-date-groups')
      const completed = makeTask({ id: 'a', completed: true, due_date: '2026-06-15T12:00:00.000Z' })
      const other = makeTask({ id: 'b', due_date: '2026-06-16T12:00:00.000Z' })
      const noDue = makeTask({ id: 'c', due_date: null })
      expect(getTodayTodos([completed, other, noDue], NOW)).toEqual([])
    })
  })

  describe('getUpcomingByDay', () => {
    it('returns `days` groups with correct labels and matching todos', async () => {
      const { getUpcomingByDay } = await import('@/lib/task-date-groups')
      const tomorrow = makeTask({ id: 'a', due_date: '2026-06-16T12:00:00.000Z' })
      const groups = getUpcomingByDay([tomorrow], 7, NOW)
      expect(groups).toHaveLength(7)
      expect(groups[0]?.todos).toEqual([tomorrow])
      expect(groups[0]?.label).toMatch(/^\w+, \w+ \d+$/)
    })

    it('excludes completed todos from upcoming groups', async () => {
      const { getUpcomingByDay } = await import('@/lib/task-date-groups')
      const completed = makeTask({ completed: true, due_date: '2026-06-16T12:00:00.000Z' })
      const groups = getUpcomingByDay([completed], 7, NOW)
      expect(groups.every((g) => g.todos.length === 0)).toBe(true)
    })

    it('defaults to 7 days when not specified', async () => {
      const { getUpcomingByDay } = await import('@/lib/task-date-groups')
      const groups = getUpcomingByDay([], undefined, NOW)
      expect(groups).toHaveLength(7)
    })
  })

  describe('getLaterTodos', () => {
    it('includes todos beyond the window', async () => {
      const { getLaterTodos } = await import('@/lib/task-date-groups')
      const later = makeTask({ id: 'a', due_date: '2026-07-01T12:00:00.000Z' })
      expect(getLaterTodos([later], 7, NOW)).toEqual([later])
    })

    it('excludes todos within the window, completed, or with no due date', async () => {
      const { getLaterTodos } = await import('@/lib/task-date-groups')
      const within = makeTask({ id: 'a', due_date: '2026-06-16T12:00:00.000Z' })
      const completed = makeTask({ id: 'b', completed: true, due_date: '2026-08-01T12:00:00.000Z' })
      const noDue = makeTask({ id: 'c', due_date: null })
      expect(getLaterTodos([within, completed, noDue], 7, NOW)).toEqual([])
    })
  })

  describe('getInboxTodos', () => {
    it('includes todos with null list_id', async () => {
      const { getInboxTodos } = await import('@/lib/task-date-groups')
      const noList = makeTask({ id: 'a', list_id: null })
      expect(getInboxTodos([noList], null)).toEqual([noList])
    })

    it('includes todos assigned to the default list', async () => {
      const { getInboxTodos } = await import('@/lib/task-date-groups')
      const defaultListTask = makeTask({ id: 'a', list_id: 'list-default' })
      expect(getInboxTodos([defaultListTask], 'list-default')).toEqual([defaultListTask])
    })

    it('excludes todos in a non-default list', async () => {
      const { getInboxTodos } = await import('@/lib/task-date-groups')
      const other = makeTask({ id: 'a', list_id: 'list-other' })
      expect(getInboxTodos([other], 'list-default')).toEqual([])
    })
  })

  describe('getLogbookGroups', () => {
    it('groups completed todos by day, newest first', async () => {
      const { getLogbookGroups } = await import('@/lib/task-date-groups')
      const older = makeTask({ id: 'a', completed: true, updated_at: '2026-06-10T10:00:00.000Z' })
      const newer = makeTask({ id: 'b', completed: true, updated_at: '2026-06-14T10:00:00.000Z' })
      const groups = getLogbookGroups([older, newer])
      expect(groups).toHaveLength(2)
      expect(groups[0]?.todos[0]?.id).toBe('b')
      expect(groups[1]?.todos[0]?.id).toBe('a')
    })

    it('sorts todos within the same day newest first', async () => {
      const { getLogbookGroups } = await import('@/lib/task-date-groups')
      const early = makeTask({ id: 'a', completed: true, updated_at: '2026-06-10T08:00:00.000Z' })
      const late = makeTask({ id: 'b', completed: true, updated_at: '2026-06-10T18:00:00.000Z' })
      const groups = getLogbookGroups([early, late])
      expect(groups).toHaveLength(1)
      expect(groups[0]?.todos.map((t) => t.id)).toEqual(['b', 'a'])
    })

    it('excludes incomplete todos', async () => {
      const { getLogbookGroups } = await import('@/lib/task-date-groups')
      const incomplete = makeTask({ completed: false })
      expect(getLogbookGroups([incomplete])).toEqual([])
    })

    it('returns an empty array when there are no completed todos', async () => {
      const { getLogbookGroups } = await import('@/lib/task-date-groups')
      expect(getLogbookGroups([])).toEqual([])
    })
  })

  describe('getTodosForDay', () => {
    it('returns todos due on the given day', async () => {
      const { getTodosForDay } = await import('@/lib/task-date-groups')
      const day = new Date('2026-06-15T12:00:00.000Z')
      const match = makeTask({ id: 'a', due_date: '2026-06-15T18:00:00.000Z' })
      const noMatch = makeTask({ id: 'b', due_date: '2026-06-16T12:00:00.000Z' })
      expect(getTodosForDay([match, noMatch], day)).toEqual([match])
    })

    it('excludes todos with no due date', async () => {
      const { getTodosForDay } = await import('@/lib/task-date-groups')
      const noDue = makeTask({ due_date: null })
      expect(getTodosForDay([noDue], new Date('2026-06-15T12:00:00.000Z'))).toEqual([])
    })

    it('includes completed todos due on that day (no completed filter)', async () => {
      const { getTodosForDay } = await import('@/lib/task-date-groups')
      const day = new Date('2026-06-15T12:00:00.000Z')
      const completed = makeTask({ completed: true, due_date: '2026-06-15T12:00:00.000Z' })
      expect(getTodosForDay([completed], day)).toEqual([completed])
    })
  })

  describe('isDayWithinRange', () => {
    it('returns true when day is within [start, end]', async () => {
      const { isDayWithinRange } = await import('@/lib/task-date-groups')
      const start = new Date('2026-06-10T12:00:00.000Z')
      const end = new Date('2026-06-20T12:00:00.000Z')
      const day = new Date('2026-06-15T12:00:00.000Z')
      expect(isDayWithinRange(day, start, end)).toBe(true)
    })

    it('returns true when day equals start or end boundary', async () => {
      const { isDayWithinRange } = await import('@/lib/task-date-groups')
      const start = new Date('2026-06-10T12:00:00.000Z')
      const end = new Date('2026-06-20T12:00:00.000Z')
      // isDayWithinRange compares day-level (startOfDay) boundaries, so the
      // boundary check must use each date's own local start-of-day instant,
      // not a midday instant that would fall after startOfDay(end).
      const startOfEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      expect(isDayWithinRange(start, start, end)).toBe(true)
      expect(isDayWithinRange(startOfEndDay, start, end)).toBe(true)
    })

    it('returns false when day is outside the range', async () => {
      const { isDayWithinRange } = await import('@/lib/task-date-groups')
      const start = new Date('2026-06-10T12:00:00.000Z')
      const end = new Date('2026-06-20T12:00:00.000Z')
      const outside = new Date('2026-07-01T12:00:00.000Z')
      expect(isDayWithinRange(outside, start, end)).toBe(false)
    })
  })
})

// ── markdown-lite.ts ──────────────────────────────────────────────────────────

describe('markdown-lite', () => {
  it('escapes raw HTML special characters', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('<script>alert("x")</script> & \'quote\'')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
    expect(html).toContain('&#39;')
  })

  it('renders bold text', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    expect(renderMarkdownLite('**bold**')).toBe('<p><strong>bold</strong></p>')
  })

  it('renders italic text', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    expect(renderMarkdownLite('*italic*')).toBe('<p><em>italic</em></p>')
  })

  it('renders inline code', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('`code`')
    expect(html).toContain('<code')
    expect(html).toContain('>code</code>')
  })

  it('renders http/https links with safe attributes', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('[click here](https://example.com/path)')
    expect(html).toContain('<a href="https://example.com/path"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('>click here</a>')
  })

  it('does not treat javascript: URLs as links', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('[bad](javascript:alert(1))')
    expect(html).not.toContain('<a href="javascript:')
  })

  it('renders h1/h2/h3 headings with distinct size classes', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const h1 = renderMarkdownLite('# Heading 1')
    const h2 = renderMarkdownLite('## Heading 2')
    const h3 = renderMarkdownLite('### Heading 3')
    expect(h1).toContain('text-base font-bold')
    expect(h2).toContain('text-sm font-bold')
    expect(h3).toContain('text-sm font-semibold')
  })

  it('renders a bullet list and closes the <ul> tag', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('- one\n- two')
    expect(html).toBe(
      '<ul class="list-disc list-inside space-y-0.5"><li>one</li><li>two</li></ul>',
    )
  })

  it('closes an open list when a blank line follows', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('- one\n\nafter')
    expect(html).toBe('<ul class="list-disc list-inside space-y-0.5"><li>one</li></ul><p>after</p>')
  })

  it('closes an open list when a heading follows', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('- one\n# Heading')
    expect(html).toBe(
      '<ul class="list-disc list-inside space-y-0.5"><li>one</li></ul><p class="text-base font-bold mt-2 mb-1">Heading</p>',
    )
  })

  it('closes an open list when a plain paragraph line follows', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('- one\nplain text')
    expect(html).toBe('<ul class="list-disc list-inside space-y-0.5"><li>one</li></ul><p>plain text</p>')
  })

  it('closes a trailing open list at end of input', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('- only item')
    expect(html.endsWith('</ul>')).toBe(true)
  })

  it('skips blank lines with no open list (no-op)', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('para one\n\npara two')
    expect(html).toBe('<p>para one</p><p>para two</p>')
  })

  it('renders an empty string as empty output', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    expect(renderMarkdownLite('')).toBe('')
  })

  it('applies inline formatting within list items', async () => {
    const { renderMarkdownLite } = await import('@/lib/markdown-lite')
    const html = renderMarkdownLite('- **bold** item')
    expect(html).toContain('<li><strong>bold</strong> item</li>')
  })
})

// ── notifications.ts ──────────────────────────────────────────────────────────

describe('notifications', () => {
  beforeEach(() => {
    mockIsTauri.mockReset()
    mockInvoke.mockReset()
  })

  describe('requestNotificationPermission', () => {
    it('returns false when not in Tauri', async () => {
      mockIsTauri.mockReturnValue(false)
      const { requestNotificationPermission } = await import('@/lib/notifications')
      expect(await requestNotificationPermission()).toBe(false)
    })

    it('returns true when in Tauri', async () => {
      mockIsTauri.mockReturnValue(true)
      const { requestNotificationPermission } = await import('@/lib/notifications')
      expect(await requestNotificationPermission()).toBe(true)
    })
  })

  describe('sendTaskDueNotification', () => {
    it('no-ops in browser (invoke not called)', async () => {
      mockIsTauri.mockReturnValue(false)
      const { sendTaskDueNotification } = await import('@/lib/notifications')
      await sendTaskDueNotification({ id: 't1', title: 'Task' }, 10)
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('sends "due now" body when minutesUntilDue <= 0', async () => {
      mockIsTauri.mockReturnValue(true)
      mockInvoke.mockResolvedValue(undefined)
      const { sendTaskDueNotification } = await import('@/lib/notifications')
      await sendTaskDueNotification({ id: 't1', title: 'Buy milk' }, 0)
      expect(mockInvoke).toHaveBeenCalledWith('send_notification', {
        title: 'ɳTask — Task Due',
        body: '"Buy milk" is due now.',
        icon: null,
      })
    })

    it('uses singular "minute" when exactly 1 minute remains', async () => {
      mockIsTauri.mockReturnValue(true)
      mockInvoke.mockResolvedValue(undefined)
      const { sendTaskDueNotification } = await import('@/lib/notifications')
      await sendTaskDueNotification({ id: 't1', title: 'Task' }, 1)
      expect(mockInvoke).toHaveBeenCalledWith(
        'send_notification',
        expect.objectContaining({ body: '"Task" is due in 1 minute.' }),
      )
    })

    it('uses plural "minutes" when more than 1 minute remains', async () => {
      mockIsTauri.mockReturnValue(true)
      mockInvoke.mockResolvedValue(undefined)
      const { sendTaskDueNotification } = await import('@/lib/notifications')
      await sendTaskDueNotification({ id: 't1', title: 'Task' }, 5)
      expect(mockInvoke).toHaveBeenCalledWith(
        'send_notification',
        expect.objectContaining({ body: '"Task" is due in 5 minutes.' }),
      )
    })
  })

  describe('sendSyncNotification', () => {
    it('no-ops in browser (invoke not called)', async () => {
      mockIsTauri.mockReturnValue(false)
      const { sendSyncNotification } = await import('@/lib/notifications')
      await sendSyncNotification('success', 'All synced')
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('sends a success title for type "success"', async () => {
      mockIsTauri.mockReturnValue(true)
      mockInvoke.mockResolvedValue(undefined)
      const { sendSyncNotification } = await import('@/lib/notifications')
      await sendSyncNotification('success', 'All synced')
      expect(mockInvoke).toHaveBeenCalledWith('send_notification', {
        title: 'ɳTask — Synced',
        body: 'All synced',
        icon: null,
      })
    })

    it('sends an error title for type "error"', async () => {
      mockIsTauri.mockReturnValue(true)
      mockInvoke.mockResolvedValue(undefined)
      const { sendSyncNotification } = await import('@/lib/notifications')
      await sendSyncNotification('error', 'Network down')
      expect(mockInvoke).toHaveBeenCalledWith('send_notification', {
        title: 'ɳTask — Sync Failed',
        body: 'Network down',
        icon: null,
      })
    })
  })
})

// ── graphql-ws-client.ts ──────────────────────────────────────────────────────

const mockCreateClient = vi.fn()

vi.mock('graphql-ws', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

describe('graphql-ws-client', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    mockCreateClient.mockReset()
    mockCreateClient.mockImplementation((opts: { connectionParams: () => unknown }) => ({
      dispose: vi.fn().mockResolvedValue(undefined),
      __opts: opts,
    }))
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('creates a singleton client — same instance returned on repeated calls', async () => {
    const { getWsClient } = await import('@/lib/graphql-ws-client')
    const c1 = getWsClient()
    const c2 = getWsClient()
    expect(c1).toBe(c2)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })

  it('disposeWsClient disposes and clears the singleton so a new one is created next', async () => {
    const { getWsClient, disposeWsClient } = await import('@/lib/graphql-ws-client')
    const c1 = getWsClient() as unknown as { dispose: ReturnType<typeof vi.fn> }
    disposeWsClient()
    expect(c1.dispose).toHaveBeenCalled()

    const c2 = getWsClient()
    expect(mockCreateClient).toHaveBeenCalledTimes(2)
    expect(c2).not.toBe(c1)
  })

  it('disposeWsClient is a no-op when no client has been created', async () => {
    const { disposeWsClient } = await import('@/lib/graphql-ws-client')
    expect(() => disposeWsClient()).not.toThrow()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('connectionParams returns Authorization header when fetch resolves a top-level token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'abc123' }),
    }) as unknown as typeof fetch

    const { getWsClient } = await import('@/lib/graphql-ws-client')
    getWsClient()
    const opts = mockCreateClient.mock.calls[0]?.[0] as { connectionParams: () => Promise<unknown> }
    const params = await opts.connectionParams()
    expect(params).toEqual({ headers: { Authorization: 'Bearer abc123' } })
  })

  it('connectionParams falls back to user.token when top-level token absent', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { token: 'nested-token' } }),
    }) as unknown as typeof fetch

    const { getWsClient } = await import('@/lib/graphql-ws-client')
    getWsClient()
    const opts = mockCreateClient.mock.calls[0]?.[0] as { connectionParams: () => Promise<unknown> }
    const params = await opts.connectionParams()
    expect(params).toEqual({ headers: { Authorization: 'Bearer nested-token' } })
  })

  it('connectionParams returns {} when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch

    const { getWsClient } = await import('@/lib/graphql-ws-client')
    getWsClient()
    const opts = mockCreateClient.mock.calls[0]?.[0] as { connectionParams: () => Promise<unknown> }
    const params = await opts.connectionParams()
    expect(params).toEqual({})
  })

  it('connectionParams returns {} when no token present', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch

    const { getWsClient } = await import('@/lib/graphql-ws-client')
    getWsClient()
    const opts = mockCreateClient.mock.calls[0]?.[0] as { connectionParams: () => Promise<unknown> }
    const params = await opts.connectionParams()
    expect(params).toEqual({})
  })

  it('connectionParams returns {} when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const { getWsClient } = await import('@/lib/graphql-ws-client')
    getWsClient()
    const opts = mockCreateClient.mock.calls[0]?.[0] as { connectionParams: () => Promise<unknown> }
    const params = await opts.connectionParams()
    expect(params).toEqual({})
  })

  it('exports a SUBSCRIBE_LIST_TODOS GraphQL subscription string', async () => {
    const { SUBSCRIBE_LIST_TODOS } = await import('@/lib/graphql-ws-client')
    expect(SUBSCRIBE_LIST_TODOS).toContain('subscription SubscribeListTodos')
    expect(SUBSCRIBE_LIST_TODOS).toContain('np_todos')
  })
})
