/**
 * coverage-boost-2.test.tsx — RTL coverage for SignupPage, ProfilePage,
 *   SearchModal, and ListMembersPanel.
 *
 * Purpose: Raise line coverage on four 0%-covered files.
 * SPORT: wave5-tv-i18n coverage gate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/lib/api', () => ({
  auth: {
    signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signIn: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { email: 'test@example.com' } }),
    signOut: vi.fn().mockResolvedValue({}),
  },
  gql: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock('@/lib/graphql', () => ({
  createList: vi.fn().mockResolvedValue({ id: 'l-1', title: 'My Tasks' }),
  createTodo: vi.fn().mockResolvedValue(null),
  getProfile: vi.fn().mockResolvedValue({ id: 'p-1', display_name: 'Test User' }),
  updateProfile: vi.fn().mockResolvedValue(null),
  updatePreferences: vi.fn().mockResolvedValue(null),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}))

const mockRefetch = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'test@example.com' }, refetch: mockRefetch }),
}))

vi.mock('@/hooks/useListPermission', () => ({
  useListPermission: () => ({ canManageMembers: false }),
}))

vi.mock('@/lib/graphql-collab', () => ({
  getListMembers: vi.fn().mockResolvedValue([]),
  removeMember: vi.fn().mockResolvedValue(null),
  updateMemberRole: vi.fn().mockResolvedValue(null),
  leaveList: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/components/tasks/SearchBar', () => ({
  SearchBar: ({ onResults, onQueryChange }: { onResults: (r: unknown[]) => void; onQueryChange?: (q: string) => void }) => (
    <input
      aria-label="search"
      onChange={(e) => {
        onQueryChange?.(e.target.value)
        onResults([])
      }}
    />
  ),
}))

// ── SignupPage ─────────────────────────────────────────────────────────────────

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form fields and branding', async () => {
    const { SignupPage } = await import('@/pages/app/SignupPage')
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )
    expect(screen.getByText('ɳTask')).toBeDefined()
    expect(screen.getByLabelText('auth.nameLabel')).toBeDefined()
    expect(screen.getByLabelText('auth.emailLabel')).toBeDefined()
    expect(screen.getByLabelText('auth.passwordLabel')).toBeDefined()
    expect(screen.getByRole('button', { name: 'auth.createAccount' })).toBeDefined()
  })

  it('submit button is disabled until ToS is accepted', async () => {
    const { SignupPage } = await import('@/pages/app/SignupPage')
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button', { name: 'auth.createAccount' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(btn.disabled).toBe(false)
  })

  it('fills fields and submits successfully — navigates to verify-email', async () => {
    const user = userEvent.setup()
    const { SignupPage } = await import('@/pages/app/SignupPage')
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('auth.nameLabel'), 'Ali')
    await user.type(screen.getByLabelText('auth.emailLabel'), 'ali@test.com')
    await user.type(screen.getByLabelText('auth.passwordLabel'), 'password123')
    fireEvent.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'auth.createAccount' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/verify-email')
    })
  })

  it('shows error message when signUp fails', async () => {
    const { auth } = await import('@/lib/api')
    vi.mocked(auth.signUp).mockResolvedValueOnce({ data: {}, error: { message: 'Email taken' } })

    const user = userEvent.setup()
    const { SignupPage } = await import('@/pages/app/SignupPage')
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('auth.emailLabel'), 'taken@test.com')
    await user.type(screen.getByLabelText('auth.passwordLabel'), 'password123')
    fireEvent.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'auth.createAccount' }))

    await waitFor(() => {
      expect(screen.getByText('Email taken')).toBeDefined()
    })
  })

  it('shows error when signIn fails after signUp', async () => {
    const { auth } = await import('@/lib/api')
    vi.mocked(auth.signIn).mockResolvedValueOnce({ data: {}, error: { message: 'Sign in failed' } })

    const user = userEvent.setup()
    const { SignupPage } = await import('@/pages/app/SignupPage')
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('auth.emailLabel'), 'new@test.com')
    await user.type(screen.getByLabelText('auth.passwordLabel'), 'password123')
    fireEvent.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'auth.createAccount' }))

    await waitFor(() => {
      expect(screen.getByText('Sign in failed')).toBeDefined()
    })
  })
})

// ── ProfilePage ───────────────────────────────────────────────────────────────

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile heading and form', async () => {
    const { ProfilePage } = await import('@/pages/app/ProfilePage')
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'profile.title' })).toBeDefined()
    expect(screen.getByLabelText('profile.displayName')).toBeDefined()
  })

  it('loads user email and display name from API', async () => {
    const { ProfilePage } = await import('@/pages/app/ProfilePage')
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeDefined()
    })
  })

  it('renders theme selector buttons', async () => {
    const { ProfilePage } = await import('@/pages/app/ProfilePage')
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: 'profile.themeSystem' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'profile.themeLight' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'profile.themeDark' })).toBeDefined()
  })

  it('saves profile on form submit', async () => {
    const { updateProfile } = await import('@/lib/graphql')
    const user = userEvent.setup()
    const { ProfilePage } = await import('@/pages/app/ProfilePage')
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByDisplayValue('Test User'))

    const input = screen.getByLabelText('profile.displayName')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.click(screen.getByRole('button', { name: 'profile.saveChanges' }))

    await waitFor(() => {
      expect(vi.mocked(updateProfile)).toHaveBeenCalled()
    })
  })

  it('signs out and navigates to login', async () => {
    const { auth } = await import('@/lib/api')
    const user = userEvent.setup()
    const { ProfilePage } = await import('@/pages/app/ProfilePage')
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'profile.signOut' }))

    await waitFor(() => {
      expect(vi.mocked(auth.signOut)).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})

// ── SearchModal ───────────────────────────────────────────────────────────────

const makeLocalStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

describe('SearchModal', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', makeLocalStorageMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders dialog with search input', async () => {
    const { SearchModal } = await import('@/components/search/SearchModal')
    render(
      <MemoryRouter>
        <SearchModal onClose={onClose} />
      </MemoryRouter>
    )
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByLabelText('search')).toBeDefined()
  })

  it('closes when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const { SearchModal } = await import('@/components/search/SearchModal')
    const { container } = render(
      <MemoryRouter>
        <SearchModal onClose={onClose} />
      </MemoryRouter>
    )
    // click the fixed backdrop (first child of container)
    await user.click(container.firstChild as Element)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape key', async () => {
    const { SearchModal } = await import('@/components/search/SearchModal')
    render(
      <MemoryRouter>
        <SearchModal onClose={onClose} />
      </MemoryRouter>
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows recent searches from localStorage', async () => {
    localStorage.setItem('ntask_recent_searches', JSON.stringify(['buy milk', 'call mom']))
    const { SearchModal } = await import('@/components/search/SearchModal')
    render(
      <MemoryRouter>
        <SearchModal onClose={onClose} />
      </MemoryRouter>
    )
    expect(screen.getByText('buy milk')).toBeDefined()
    expect(screen.getByText('call mom')).toBeDefined()
  })

  it('shows empty state hint when query >= 2 chars returns no results', async () => {
    const user = userEvent.setup()
    const { SearchModal } = await import('@/components/search/SearchModal')
    render(
      <MemoryRouter>
        <SearchModal onClose={onClose} />
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText('search'), 'ab')
    await waitFor(() => {
      // The empty hint uses t('search.emptyHint') which returns the key itself in tests
      expect(screen.getByText((text) => text.includes('search.emptyHint'))).toBeDefined()
    })
  })
})

// ── ListMembersPanel ──────────────────────────────────────────────────────────

describe('ListMembersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', async () => {
    // Keep getListMembers pending so loading stays true
    const { getListMembers } = await import('@/lib/graphql-collab')
    vi.mocked(getListMembers).mockReturnValueOnce(new Promise(() => {}))

    const { ListMembersPanel } = await import('@/components/collaboration/ListMembersPanel')
    render(
      <MemoryRouter>
        <ListMembersPanel listId="list-1" />
      </MemoryRouter>
    )
    expect(screen.getByText('states.loading')).toBeDefined()
  })

  it('shows empty state when no members returned', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    vi.mocked(getListMembers).mockResolvedValueOnce([])

    const { ListMembersPanel } = await import('@/components/collaboration/ListMembersPanel')
    render(
      <MemoryRouter>
        <ListMembersPanel listId="list-1" />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('collab.noMembers')).toBeDefined()
    })
  })

  it('renders member rows with display name and role badge', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    vi.mocked(getListMembers).mockResolvedValueOnce([
      {
        id: 'm-1',
        user_id: 'other-user',
        list_id: 'list-1',
        role: 'viewer',
        profile: { display_name: 'Jane Doe', email: 'jane@test.com' },
      } as import('@nself/ntask-core').NpListMember,
    ])

    const { ListMembersPanel } = await import('@/components/collaboration/ListMembersPanel')
    render(
      <MemoryRouter>
        <ListMembersPanel listId="list-1" />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeDefined()
    })
    // role badge key rendered by t()
    expect(screen.getByText('collab.roleViewer')).toBeDefined()
  })

  it('shows Leave list button for current user who is not owner', async () => {
    const { getListMembers } = await import('@/lib/graphql-collab')
    vi.mocked(getListMembers).mockResolvedValueOnce([
      {
        id: 'm-2',
        user_id: 'u-1', // same as useAuth mock
        list_id: 'list-1',
        role: 'editor',
        profile: { display_name: 'Me', email: 'test@example.com' },
      } as import('@nself/ntask-core').NpListMember,
    ])

    const { ListMembersPanel } = await import('@/components/collaboration/ListMembersPanel')
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <ListMembersPanel listId="list-1" onClose={onClose} />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('collab.leaveList')).toBeDefined()
    })
  })

  it('calls leaveList and navigates when Leave is clicked', async () => {
    const { getListMembers, leaveList } = await import('@/lib/graphql-collab')
    vi.mocked(getListMembers).mockResolvedValueOnce([
      {
        id: 'm-3',
        user_id: 'u-1',
        list_id: 'list-1',
        role: 'editor',
        profile: { display_name: 'Me', email: 'test@example.com' },
      } as import('@nself/ntask-core').NpListMember,
    ])

    const { ListMembersPanel } = await import('@/components/collaboration/ListMembersPanel')
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <ListMembersPanel listId="list-1" onClose={onClose} />
      </MemoryRouter>
    )
    await waitFor(() => screen.getByText('collab.leaveList'))
    await userEvent.click(screen.getByText('collab.leaveList'))

    await waitFor(() => {
      expect(vi.mocked(leaveList)).toHaveBeenCalledWith('list-1', 'u-1')
      expect(onClose).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/lists', { replace: true })
    })
  })
})
