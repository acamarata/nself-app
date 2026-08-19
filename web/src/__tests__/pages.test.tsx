/**
 * pages.test.tsx — RTL render tests for app pages
 *
 * Purpose: Verify key pages render without throwing and display expected content.
 *          Covers: NotFoundPage, LoginPage, ListsPage, SearchPage, SettingsPage, SharedListPage.
 * SPORT: T-P3-E3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  gql: vi.fn(),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { id: 'user-1', email: 'test@example.com', emailVerified: true },
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  },
}))

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
  // SettingsPage (rendered by the RTL tests) calls getPreferredLocale on mount.
  // Previously this gap was masked because pages.test.tsx OOM'd before these
  // tests ran; with the LoginPage loop fixed they execute and need the export.
  getPreferredLocale: () => null,
}))

// useAuth is a stable-return vi.fn so individual describe blocks can override it.
// The default returns an authenticated user (most pages assume a logged-in
// session). LoginPage MUST override this to user:null — see the note in its
// describe block: LoginPage's redirect-if-authenticated effect otherwise fires
// navigate('/lists') on every render, and because a fresh mock object was
// returned per call the effect's [user] dep changed every render, spinning an
// infinite navigate→re-render loop that OOM'd the worker (~5.6GB).
const authenticatedAuth = {
  user: { id: 'user-1', email: 'test@example.com', displayName: 'Test' } as
    | { id: string; email: string; displayName: string }
    | null,
  loading: false,
  signOut: vi.fn(),
  refetch: vi.fn(),
  emailVerified: true,
  error: null,
}
const useAuthMock = vi.fn(() => authenticatedAuth)

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => useAuthMock(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/graphql', () => ({
  getLists: vi.fn().mockResolvedValue([]),
  createList: vi.fn().mockResolvedValue(null),
  updateList: vi.fn().mockResolvedValue(null),
  deleteList: vi.fn().mockResolvedValue(true),
  searchTodos: vi.fn().mockResolvedValue([]),
  getTags: vi.fn().mockResolvedValue([]),
  getUserPreferences: vi.fn().mockResolvedValue(null),
  updatePreferences: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/graphql-collab', () => ({
  getSharedList: vi.fn().mockResolvedValue(null),
  updateSharedTodo: vi.fn().mockResolvedValue(true),
  getPendingInvites: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

vi.mock('@/hooks/useScreenState', () => ({
  useScreenState: ({ loading, data }: { loading: boolean; data: unknown }) => ({
    state: loading ? 'loading' : (data && (Array.isArray(data) ? data.length > 0 : true)) ? 'content' : 'empty',
    isLoading: loading,
    isEmpty: !loading && (!data || (Array.isArray(data) && data.length === 0)),
    isError: false,
    isOffline: false,
  }),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}))

vi.mock('@/pages/app/settings/AccountTab', () => ({
  AccountTab: ({ userEmail }: { userEmail: string }) => (
    <div data-testid="account-tab">{userEmail}</div>
  ),
}))

vi.mock('@/components/tasks/ListCard', () => ({
  ListCard: ({ list }: { list: { title: string } }) => <div>{list.title}</div>,
}))

vi.mock('@/components/tasks/LoadingSkeleton', () => ({
  ListSkeleton: () => <div data-testid="list-skeleton">Loading...</div>,
}))

vi.mock('@/components/tasks/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('@/components/tasks/NewListModal', () => ({
  NewListModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="new-list-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('@/components/tasks/SearchBar', () => ({
  SearchBar: ({ onResults }: { onResults: (r: unknown[]) => void }) => (
    <input
      aria-label="search-bar"
      placeholder="Search"
      onChange={(e) => {
        if (e.target.value.length >= 2) onResults([])
      }}
    />
  ),
}))

// ── Render helper ─────────────────────────────────────────────────────────────

function renderInRouter(ui: React.ReactElement, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui}
    </MemoryRouter>
  )
}

// ── NotFoundPage ─────────────────────────────────────────────────────────────

describe('NotFoundPage', () => {
  it('renders 404 heading', async () => {
    const { NotFoundPage } = await import('@/pages/NotFoundPage')
    renderInRouter(<NotFoundPage />)
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders "Page not found" message', async () => {
    const { NotFoundPage } = await import('@/pages/NotFoundPage')
    renderInRouter(<NotFoundPage />)
    expect(screen.getByText('notFound')).toBeInTheDocument()
  })

  it('renders return home link', async () => {
    const { NotFoundPage } = await import('@/pages/NotFoundPage')
    renderInRouter(<NotFoundPage />)
    expect(screen.getByRole('link', { name: /returnHome/i })).toBeInTheDocument()
  })

  it('renders brand link to home', async () => {
    const { NotFoundPage } = await import('@/pages/NotFoundPage')
    renderInRouter(<NotFoundPage />)
    expect(screen.getByRole('link', { name: /homeAriaLabel/i })).toBeInTheDocument()
  })

  it('renders correctly in RTL (Arabic locale)', async () => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'ar')

    const { NotFoundPage } = await import('@/pages/NotFoundPage')
    renderInRouter(<NotFoundPage />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')

    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', 'en')
  })
})

// ── LoginPage ─────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  // A visitor on the login page is logged OUT. Override useAuth to user:null so
  // LoginPage's redirect-if-authenticated effect stays dormant — otherwise it
  // navigates on every render and (with an unstable mock object) loops forever,
  // OOMing the worker. Restore the authenticated default afterwards so later
  // describe blocks are unaffected.
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ ...authenticatedAuth, user: null })
  })
  afterEach(() => {
    useAuthMock.mockReturnValue(authenticatedAuth)
  })

  it('renders email and password inputs', async () => {
    const { LoginPage } = await import('@/pages/app/LoginPage')
    renderInRouter(<LoginPage />)
    expect(screen.getByLabelText(/auth\.emailLabel/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.passwordLabel/i)).toBeInTheDocument()
  })

  it('renders sign-in button', async () => {
    const { LoginPage } = await import('@/pages/app/LoginPage')
    renderInRouter(<LoginPage />)
    expect(screen.getByRole('button', { name: /auth\.signIn/i })).toBeInTheDocument()
  })

  it('renders forgot password link', async () => {
    const { LoginPage } = await import('@/pages/app/LoginPage')
    renderInRouter(<LoginPage />)
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
  })

  it('shows error when sign in fails', async () => {
    const { auth } = await import('@/lib/api')
    const authMock = auth as { signIn: ReturnType<typeof vi.fn> }
    authMock.signIn.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } })

    const { LoginPage } = await import('@/pages/app/LoginPage')
    const user = userEvent.setup()

    renderInRouter(<LoginPage />)

    await user.type(screen.getByLabelText(/auth\.emailLabel/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/auth\.passwordLabel/i), 'badpassword')
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls signIn with email and password on submit', async () => {
    const { auth } = await import('@/lib/api')
    const authMock = auth as { signIn: ReturnType<typeof vi.fn> }
    authMock.signIn.mockResolvedValueOnce({ data: {}, error: null })

    const { LoginPage } = await import('@/pages/app/LoginPage')
    const user = userEvent.setup()

    renderInRouter(<LoginPage />)

    await user.type(screen.getByLabelText(/auth\.emailLabel/i), 'user@example.com')
    await user.type(screen.getByLabelText(/auth\.passwordLabel/i), 'password123')
    await user.click(screen.getByRole('button', { name: /auth\.signIn/i }))

    await waitFor(() => {
      expect(authMock.signIn).toHaveBeenCalledWith('user@example.com', 'password123')
    })
  })
})

// ── ListsPage ────────────────────────────────────────────────────────────────

describe('ListsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders Lists heading', async () => {
    const { getLists } = await import('@/lib/graphql')
    const getListsMock = getLists as ReturnType<typeof vi.fn>
    getListsMock.mockResolvedValue([])

    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ data: { id: 'u-1', email: 'x@x.com' } })

    const { ListsPage } = await import('@/pages/app/ListsPage')
    renderInRouter(<ListsPage />)

    expect(screen.getByText('lists.title')).toBeInTheDocument()
  })

  it('renders empty state when no lists', async () => {
    const { getLists } = await import('@/lib/graphql')
    const getListsMock = getLists as ReturnType<typeof vi.fn>
    getListsMock.mockResolvedValue([])

    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ data: { id: 'u-1', email: 'x@x.com' } })

    const { ListsPage } = await import('@/pages/app/ListsPage')
    renderInRouter(<ListsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })

  it('renders list cards when lists exist', async () => {
    const { getLists } = await import('@/lib/graphql')
    const getListsMock = getLists as ReturnType<typeof vi.fn>
    getListsMock.mockResolvedValue([
      { id: 'l-1', title: 'Work', user_id: 'u-1', color: '#f00', icon: '', is_default: false, position: 0, group_id: null, source_account_id: 'primary', created_at: '', updated_at: '' },
    ])

    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ data: { id: 'u-1', email: 'x@x.com' } })

    const { ListsPage } = await import('@/pages/app/ListsPage')
    renderInRouter(<ListsPage />)

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument()
    })
  })

  it('opens new list modal when button clicked', async () => {
    const { getLists } = await import('@/lib/graphql')
    const getListsMock = getLists as ReturnType<typeof vi.fn>
    getListsMock.mockResolvedValue([])

    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ data: { id: 'u-1', email: 'x@x.com' } })

    const { ListsPage } = await import('@/pages/app/ListsPage')
    const user = userEvent.setup()

    renderInRouter(<ListsPage />)

    await waitFor(() => {
      expect(screen.getByText('lists.emptyTitle')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /lists.newList/i }))
    expect(screen.getByTestId('new-list-modal')).toBeInTheDocument()
  })

  it('handles auth failure gracefully', async () => {
    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ error: { message: 'Not authed' }, data: null })

    const { ListsPage } = await import('@/pages/app/ListsPage')
    renderInRouter(<ListsPage />)

    await waitFor(() => {
      // Should not crash; no list skeleton visible
      expect(screen.queryByTestId('list-skeleton')).not.toBeInTheDocument()
    })
  })
})

// ── SearchPage ────────────────────────────────────────────────────────────────

describe('SearchPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders Search heading', async () => {
    const { SearchPage } = await import('@/pages/app/SearchPage')
    renderInRouter(<SearchPage />, '/app/search')
    expect(screen.getByText('search.title')).toBeInTheDocument()
  })

  it('renders search bar', async () => {
    const { SearchPage } = await import('@/pages/app/SearchPage')
    renderInRouter(<SearchPage />)
    expect(screen.getByRole('textbox', { name: 'search-bar' })).toBeInTheDocument()
  })

  it('renders correctly in RTL mode', async () => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'ar')

    const { SearchPage } = await import('@/pages/app/SearchPage')
    renderInRouter(<SearchPage />)

    expect(screen.getByText('search.title')).toBeInTheDocument()

    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', 'en')
  })
})

// ── SettingsPage ──────────────────────────────────────────────────────────────

describe('SettingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders settings tabs after load', async () => {
    const { getUserPreferences } = await import('@/lib/graphql')
    const getPrefsMock = getUserPreferences as ReturnType<typeof vi.fn>
    getPrefsMock.mockResolvedValue({
      id: 'pref-1', user_id: 'u-1', theme_preference: 'system',
      language: 'en', week_start: 'sunday', date_format: 'MM/DD/YYYY',
      notification_settings: { push: false, email: false, inApp: false },
      created_at: '', updated_at: '',
    })

    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ data: { id: 'u-1', email: 'test@example.com' } })

    const { SettingsPage } = await import('@/pages/app/SettingsPage')
    renderInRouter(<SettingsPage />)

    await waitFor(() => {
      // Settings title from t() returns the key
      expect(screen.getByText('settings.title')).toBeInTheDocument()
    })
  })

  it('renders tab navigation buttons', async () => {
    const { getUserPreferences } = await import('@/lib/graphql')
    const getPrefsMock = getUserPreferences as ReturnType<typeof vi.fn>
    getPrefsMock.mockResolvedValue(null)

    const { auth } = await import('@/lib/api')
    const authMock = auth as { getUser: ReturnType<typeof vi.fn> }
    authMock.getUser.mockResolvedValue({ data: { id: 'u-1', email: 'test@example.com' } })

    const { SettingsPage } = await import('@/pages/app/SettingsPage')
    renderInRouter(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('settings.appearance')).toBeInTheDocument()
      expect(screen.getByText('settings.language')).toBeInTheDocument()
    })
  })
})

// ── SharedListPage ────────────────────────────────────────────────────────────

describe('SharedListPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows spinner initially then invalid link card when token fails', async () => {
    const { getSharedList } = await import('@/lib/graphql-collab')
    const getSharedMock = getSharedList as ReturnType<typeof vi.fn>
    getSharedMock.mockResolvedValue(null)

    const { SharedListPage } = await import('@/pages/shared/SharedListPage')
    render(
      <MemoryRouter initialEntries={['/shared/bad-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedListPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('collab.shared.signupCta')).toBeInTheDocument()
    })
  })

  it('shows shared list content when token resolves', async () => {
    const { getSharedList } = await import('@/lib/graphql-collab')
    const getSharedMock = getSharedList as ReturnType<typeof vi.fn>
    getSharedMock.mockResolvedValue({
      list: { id: 'list-1', title: 'Team Tasks', permission: 'view' },
      todos: [
        { id: 'todo-1', title: 'First task', completed: false, position: 0 },
      ],
    })

    const { SharedListPage } = await import('@/pages/shared/SharedListPage')
    render(
      <MemoryRouter initialEntries={['/shared/valid-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedListPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Team Tasks')).toBeInTheDocument()
      expect(screen.getByText('First task')).toBeInTheDocument()
    })
  })

  it('shows view permission badge for view-only lists', async () => {
    const { getSharedList } = await import('@/lib/graphql-collab')
    const getSharedMock = getSharedList as ReturnType<typeof vi.fn>
    getSharedMock.mockResolvedValue({
      list: { id: 'list-1', title: 'Read Only', permission: 'view' },
      todos: [],
    })

    const { SharedListPage } = await import('@/pages/shared/SharedListPage')
    render(
      <MemoryRouter initialEntries={['/shared/view-token']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedListPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('collab.shared.permissionView')).toBeInTheDocument()
    })
  })

  it('shows upsell card for valid shared lists', async () => {
    const { getSharedList } = await import('@/lib/graphql-collab')
    const getSharedMock = getSharedList as ReturnType<typeof vi.fn>
    getSharedMock.mockResolvedValue({
      list: { id: 'list-1', title: 'Public List', permission: 'view' },
      todos: [],
    })

    const { SharedListPage } = await import('@/pages/shared/SharedListPage')
    render(
      <MemoryRouter initialEntries={['/shared/valid']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedListPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('collab.shared.upsellHeading')).toBeInTheDocument()
    })
  })

  it('shows empty list message when todos is empty', async () => {
    const { getSharedList } = await import('@/lib/graphql-collab')
    const getSharedMock = getSharedList as ReturnType<typeof vi.fn>
    getSharedMock.mockResolvedValue({
      list: { id: 'list-1', title: 'Empty List', permission: 'view' },
      todos: [],
    })

    const { SharedListPage } = await import('@/pages/shared/SharedListPage')
    render(
      <MemoryRouter initialEntries={['/shared/empty']}>
        <Routes>
          <Route path="/shared/:token" element={<SharedListPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('collab.shared.emptyList')).toBeInTheDocument()
    })
  })
})
