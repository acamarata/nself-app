/**
 * graphql-lib.test.ts — Unit tests for graphql-saved-views, graphql-attachments, graphql.ts
 *
 * Purpose: Coverage for all CRUD functions in the three graphql lib modules.
 *          Each function gets happy path, error path, and empty/null result path.
 * Mock strategy: vi.mock('@/lib/api') intercepts gql() calls.
 * SPORT: D2-S7-T1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Shared API mock ──────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  gql: vi.fn(),
  auth: {
    getUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  },
}))

vi.mock('@nself/ntask-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nself/ntask-core')>()
  return {
    ...actual,
    // Keep mappers real, stub GQL strings so they resolve
    GET_LISTS: 'query GetLists { np_lists { id } }',
    GET_LIST_TODOS: 'query GetListTodos { np_todos { id } }',
    GET_TODO: 'query GetTodo { np_todos_by_pk { id } }',
    SEARCH_TODOS: 'query SearchTodos { np_todos { id } }',
    CREATE_LIST: 'mutation CreateList { insert_np_lists_one { id } }',
    UPDATE_LIST: 'mutation UpdateList { update_np_lists_by_pk { id } }',
    DELETE_LIST: 'mutation DeleteList { delete_np_lists_by_pk { id } }',
    CREATE_TODO: 'mutation CreateTodo { insert_np_todos_one { id } }',
    UPDATE_TODO: 'mutation UpdateTodo { update_np_todos_by_pk { id } }',
    DELETE_TODO: 'mutation DeleteTodo { delete_np_todos_by_pk { id } }',
    TOGGLE_TODO: 'mutation ToggleTodo { update_np_todos_by_pk { id } }',
    GET_SUBTASKS: 'query GetSubtasks { np_subtasks { id } }',
    CREATE_SUBTASK: 'mutation CreateSubtask { insert_np_subtasks_one { id } }',
    UPDATE_SUBTASK: 'mutation UpdateSubtask { update_np_subtasks_by_pk { id } }',
    TOGGLE_SUBTASK: 'mutation ToggleSubtask { update_np_subtasks_by_pk { id } }',
    DELETE_SUBTASK: 'mutation DeleteSubtask { delete_np_subtasks_by_pk { id } }',
    GET_TAGS: 'query GetTags { np_tags { id } }',
    CREATE_TAG: 'mutation CreateTag { insert_np_tags_one { id } }',
    DELETE_TAG: 'mutation DeleteTag { delete_np_tags_by_pk { id } }',
    ADD_TODO_TAG: 'mutation AddTodoTag { insert_np_todos_tags_one { id } }',
    REMOVE_TODO_TAG: 'mutation RemoveTodoTag { delete_np_todos_tags_by_pk { id } }',
    GET_COMMENTS: 'query GetComments { np_comments { id } }',
    CREATE_COMMENT: 'mutation CreateComment { insert_np_comments_one { id } }',
    UPDATE_COMMENT: 'mutation UpdateComment { update_np_comments_by_pk { id } }',
    DELETE_COMMENT: 'mutation DeleteComment { update_np_comments_by_pk { id } }',
    GET_RECURRING_RULES: 'query GetRecurringRules { np_recurring_rules { id } }',
    CREATE_RECURRING_RULE: 'mutation CreateRecurringRule { insert_np_recurring_rules_one { id } }',
    UPDATE_RECURRING_RULE: 'mutation UpdateRecurringRule { update_np_recurring_rules_by_pk { id } }',
    DELETE_RECURRING_RULE: 'mutation DeleteRecurringRule { delete_np_recurring_rules_by_pk { id } }',
    GET_PROFILE: 'query GetProfile { np_profiles { id } }',
    UPDATE_PROFILE: 'mutation UpdateProfile { update_np_profiles_by_pk { id } }',
    GET_USER_PREFERENCES: 'query GetUserPreferences { np_user_preferences { id } }',
    UPDATE_PREFERENCES: 'mutation UpdatePreferences { update_np_user_preferences_by_pk { id } }',
    mapGqlListToNpList: (raw: Record<string, unknown>) => ({
      id: raw['id'] as string,
      user_id: raw['user_id'] as string,
      title: raw['title'] as string,
      description: '',
      color: '#6366f1',
      icon: '',
      is_default: false,
      position: 0,
      group_id: null,
      source_account_id: 'primary',
      created_at: raw['created_at'] as string ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    mapGqlTaskToNpTask: (raw: Record<string, unknown>) => ({
      id: raw['id'] as string,
      list_id: raw['list_id'] as string,
      title: raw['title'] as string,
      completed: false,
      priority: 'none',
      due_date: null,
      position: 0,
      source_account_id: 'primary',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    mapGqlTaskToSummary: (raw: Record<string, unknown>) => ({
      id: raw['id'] as string,
      list_id: raw['list_id'] as string,
      title: raw['title'] as string,
      completed: false,
      priority: 'none',
      due_date: null,
      position: 0,
      source_account_id: 'primary',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getGql() {
  const { gql } = await import('@/lib/api')
  return gql as ReturnType<typeof vi.fn>
}

// ── graphql-saved-views.ts ──────────────────────────────────────────────────

describe('graphql-saved-views — getSavedViews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns views on success', async () => {
    const mockView = {
      id: 'sv-1', user_id: 'u-1', name: 'My View',
      filter_params: { status: 'all', priority: '', tagIds: [], sortField: 'created_at', sortDir: 'desc' },
      sort_params: {}, created_at: new Date().toISOString(),
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_saved_views: [mockView] } })
    const { getSavedViews } = await import('@/lib/graphql-saved-views')
    const result = await getSavedViews()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('sv-1')
  })

  it('returns [] on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('Network error'), data: null })
    const { getSavedViews } = await import('@/lib/graphql-saved-views')
    const result = await getSavedViews()
    expect(result).toEqual([])
  })

  it('returns [] on empty result', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_saved_views: [] } })
    const { getSavedViews } = await import('@/lib/graphql-saved-views')
    const result = await getSavedViews()
    expect(result).toEqual([])
  })
})

describe('graphql-saved-views — createSavedView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns created view on success', async () => {
    const mockView = {
      id: 'sv-2', user_id: 'u-1', name: 'New View',
      filter_params: { status: 'active', priority: 'high', tagIds: [], sortField: 'due_date', sortDir: 'asc' },
      sort_params: {}, created_at: new Date().toISOString(),
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { insert_np_saved_views_one: mockView } })
    const { createSavedView } = await import('@/lib/graphql-saved-views')
    const result = await createSavedView(
      'New View',
      { status: 'active', priority: 'high', tagIds: [], sortField: 'due_date', sortDir: 'asc' },
      {}
    )
    expect(result?.id).toBe('sv-2')
  })

  it('returns null on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { createSavedView } = await import('@/lib/graphql-saved-views')
    const result = await createSavedView('Test', { status: 'all', priority: '', tagIds: [], sortField: 'created_at', sortDir: 'desc' }, {})
    expect(result).toBeNull()
  })
})

describe('graphql-saved-views — deleteSavedView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { delete_np_saved_views_by_pk: { id: 'sv-1' } } })
    const { deleteSavedView } = await import('@/lib/graphql-saved-views')
    const result = await deleteSavedView('sv-1')
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { deleteSavedView } = await import('@/lib/graphql-saved-views')
    const result = await deleteSavedView('sv-1')
    expect(result).toBe(false)
  })

  it('returns false when no pk returned', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { delete_np_saved_views_by_pk: null } })
    const { deleteSavedView } = await import('@/lib/graphql-saved-views')
    const result = await deleteSavedView('sv-1')
    expect(result).toBe(false)
  })
})

describe('graphql-saved-views — updateSavedView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updated view on success', async () => {
    const mockView = {
      id: 'sv-1', user_id: 'u-1', name: 'Renamed',
      filter_params: { status: 'all', priority: '', tagIds: [], sortField: 'created_at', sortDir: 'desc' },
      sort_params: {}, created_at: new Date().toISOString(),
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { update_np_saved_views_by_pk: mockView } })
    const { updateSavedView } = await import('@/lib/graphql-saved-views')
    const result = await updateSavedView('sv-1', 'Renamed')
    expect(result?.name).toBe('Renamed')
  })

  it('returns null on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { updateSavedView } = await import('@/lib/graphql-saved-views')
    const result = await updateSavedView('sv-1', 'Fail')
    expect(result).toBeNull()
  })
})

// ── graphql-attachments.ts ───────────────────────────────────────────────────

describe('graphql-attachments — getAttachments', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockAttachment = {
    id: 'att-1', todo_id: 'todo-1', user_id: 'u-1',
    filename: 'file.pdf', size_bytes: 1024, mime_type: 'application/pdf',
    storage_key: 'uploads/todo-1/file.pdf', created_at: new Date().toISOString(),
  }

  it('returns attachments on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_attachments: [mockAttachment] } })
    const { getAttachments } = await import('@/lib/graphql-attachments')
    const result = await getAttachments('todo-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.filename).toBe('file.pdf')
  })

  it('returns [] on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { getAttachments } = await import('@/lib/graphql-attachments')
    expect(await getAttachments('todo-1')).toEqual([])
  })

  it('returns [] when empty', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_attachments: [] } })
    const { getAttachments } = await import('@/lib/graphql-attachments')
    expect(await getAttachments('todo-1')).toEqual([])
  })
})

describe('graphql-attachments — createAttachment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns created attachment on success', async () => {
    const mockAttachment = {
      id: 'att-2', todo_id: 'todo-1', user_id: 'u-1',
      filename: 'image.png', size_bytes: 512, mime_type: 'image/png',
      storage_key: 'uploads/todo-1/image.png', created_at: new Date().toISOString(),
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { insert_np_attachments_one: mockAttachment } })
    const { createAttachment } = await import('@/lib/graphql-attachments')
    const result = await createAttachment({
      todo_id: 'todo-1', filename: 'image.png', size_bytes: 512,
      mime_type: 'image/png', storage_key: 'uploads/todo-1/image.png',
    })
    expect(result?.filename).toBe('image.png')
  })

  it('returns null on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { createAttachment } = await import('@/lib/graphql-attachments')
    const result = await createAttachment({
      todo_id: 'todo-1', filename: 'fail.pdf', size_bytes: 0,
      mime_type: 'application/pdf', storage_key: 'fail',
    })
    expect(result).toBeNull()
  })
})

describe('graphql-attachments — deleteAttachment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { delete_np_attachments_by_pk: { id: 'att-1' } } })
    const { deleteAttachment } = await import('@/lib/graphql-attachments')
    expect(await deleteAttachment('att-1')).toBe(true)
  })

  it('returns false on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { deleteAttachment } = await import('@/lib/graphql-attachments')
    expect(await deleteAttachment('att-1')).toBe(false)
  })
})

describe('graphql-attachments — getUploadUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns upload URL on success', async () => {
    const mockResult = {
      uploadUrl: 'https://storage.example.com/upload?token=abc',
      storagePath: 'uploads/todo-1/file.pdf',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { getUploadUrl: mockResult } })
    const { getUploadUrl } = await import('@/lib/graphql-attachments')
    const result = await getUploadUrl('file.pdf', 'application/pdf', 'todo-1')
    expect(result?.uploadUrl).toBe('https://storage.example.com/upload?token=abc')
    expect(result?.storagePath).toBe('uploads/todo-1/file.pdf')
  })

  it('returns null on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { getUploadUrl } = await import('@/lib/graphql-attachments')
    expect(await getUploadUrl('file.pdf', 'application/pdf', 'todo-1')).toBeNull()
  })
})

describe('graphql-attachments — getDownloadUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns download URL on success', async () => {
    const mockResult = {
      downloadUrl: 'https://storage.example.com/download?token=xyz',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { getDownloadUrl: mockResult } })
    const { getDownloadUrl } = await import('@/lib/graphql-attachments')
    const result = await getDownloadUrl('att-1')
    expect(result?.downloadUrl).toContain('download')
  })

  it('returns null on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { getDownloadUrl } = await import('@/lib/graphql-attachments')
    expect(await getDownloadUrl('att-1')).toBeNull()
  })
})

// ── graphql.ts — getLists ───────────────────────────────────────────────────

describe('graphql — getLists', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped lists on success', async () => {
    const raw = { id: 'list-1', user_id: 'u-1', title: 'My List', created_at: new Date().toISOString() }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_lists: [raw] } })
    const { getLists } = await import('@/lib/graphql')
    const result = await getLists()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('list-1')
  })

  it('returns [] on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { getLists } = await import('@/lib/graphql')
    expect(await getLists()).toEqual([])
  })
})

describe('graphql — createList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns created list on success', async () => {
    const raw = { id: 'list-2', user_id: 'u-1', title: 'New List', created_at: new Date().toISOString() }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { insert_np_lists_one: raw } })
    const { createList } = await import('@/lib/graphql')
    const result = await createList({ title: 'New List', color: '#fff', icon: '' })
    expect(result?.id).toBe('list-2')
  })

  it('returns null on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { createList } = await import('@/lib/graphql')
    expect(await createList({ title: 'X', color: '#fff', icon: '' })).toBeNull()
  })
})

describe('graphql — deleteList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { delete_np_lists_by_pk: { id: 'list-1' } } })
    const { deleteList } = await import('@/lib/graphql')
    expect(await deleteList('list-1')).toBe(true)
  })

  it('returns false on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { deleteList } = await import('@/lib/graphql')
    expect(await deleteList('list-1')).toBe(false)
  })
})

describe('graphql — getTags / createTag / deleteTag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getTags returns tags', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_tags: [{ id: 'tag-1', name: 'Bug', color: '#f00', user_id: 'u-1', created_at: '' }] } })
    const { getTags } = await import('@/lib/graphql')
    const result = await getTags()
    expect(result[0]?.name).toBe('Bug')
  })

  it('getTags returns [] on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { getTags } = await import('@/lib/graphql')
    expect(await getTags()).toEqual([])
  })

  it('createTag returns tag on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { insert_np_tags_one: { id: 'tag-2', name: 'Feature', color: '#0f0', user_id: 'u-1', created_at: '' } } })
    const { createTag } = await import('@/lib/graphql')
    const result = await createTag({ name: 'Feature', color: '#0f0' })
    expect(result?.name).toBe('Feature')
  })

  it('deleteTag returns true on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { delete_np_tags_by_pk: { id: 'tag-1' } } })
    const { deleteTag } = await import('@/lib/graphql')
    expect(await deleteTag('tag-1')).toBe(true)
  })
})

describe('graphql — searchTodos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns results on success', async () => {
    const raw = { id: 'todo-1', list_id: 'list-1', title: 'Fix bug', created_at: '' }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_todos: [raw] } })
    const { searchTodos } = await import('@/lib/graphql')
    const result = await searchTodos('bug')
    expect(result).toHaveLength(1)
  })

  it('returns [] on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { searchTodos } = await import('@/lib/graphql')
    expect(await searchTodos('x')).toEqual([])
  })
})

describe('graphql — toggleTodo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { update_np_todos_by_pk: { id: 'todo-1' } } })
    const { toggleTodo } = await import('@/lib/graphql')
    expect(await toggleTodo('todo-1', true)).toBe(true)
  })

  it('returns false on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { toggleTodo } = await import('@/lib/graphql')
    expect(await toggleTodo('todo-1', false)).toBe(false)
  })
})

describe('graphql — getComments / createComment', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockComment = {
    id: 'c-1', todo_id: 'todo-1', author_id: 'u-1', body: 'Hello',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    deleted_at: null,
  }

  it('getComments returns comments on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_comments: [mockComment] } })
    const { getComments } = await import('@/lib/graphql')
    const result = await getComments('todo-1')
    expect(result[0]?.body).toBe('Hello')
  })

  it('getComments returns [] on error', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ error: new Error('fail'), data: null })
    const { getComments } = await import('@/lib/graphql')
    expect(await getComments('todo-1')).toEqual([])
  })

  it('createComment returns comment on success', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { insert_np_comments_one: mockComment } })
    const { createComment } = await import('@/lib/graphql')
    const result = await createComment({ todo_id: 'todo-1', body: 'Hello', idempotency_key: 'k-1' })
    expect(result?.body).toBe('Hello')
  })
})

describe('graphql — getProfile / getUserPreferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getProfile returns first profile', async () => {
    const mockProfile = { id: 'p-1', user_id: 'u-1', display_name: 'Alice', avatar_url: null, bio: null, created_at: '', updated_at: '' }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_profiles: [mockProfile] } })
    const { getProfile } = await import('@/lib/graphql')
    const result = await getProfile()
    expect(result?.display_name).toBe('Alice')
  })

  it('getProfile returns null on empty', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_profiles: [] } })
    const { getProfile } = await import('@/lib/graphql')
    expect(await getProfile()).toBeNull()
  })

  it('getUserPreferences returns prefs on success', async () => {
    const mockPrefs = {
      id: 'pref-1', user_id: 'u-1', theme_preference: 'dark',
      language: 'en', week_start: 'monday', date_format: 'MM/DD/YYYY',
      notification_settings: { push: true, email: false, inApp: true },
      created_at: '', updated_at: '',
    }
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_user_preferences: [mockPrefs] } })
    const { getUserPreferences } = await import('@/lib/graphql')
    const result = await getUserPreferences()
    expect(result?.theme_preference).toBe('dark')
  })

  it('getUserPreferences returns null on empty', async () => {
    const gql = await getGql()
    gql.mockResolvedValueOnce({ data: { np_user_preferences: [] } })
    const { getUserPreferences } = await import('@/lib/graphql')
    expect(await getUserPreferences()).toBeNull()
  })
})
