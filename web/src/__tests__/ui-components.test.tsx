/**
 * ui-components.test.tsx — RTL render tests for UI + collaboration components
 *
 * Purpose: Cover CommandPalette, collaboration components (ShareListDialog,
 *          InviteBanner, RoleSelector, PresenceAvatarStack), DeleteAccountModal.
 * SPORT: D2-S7-T2, P5-W1-collab-*, J-S1-T2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ── Global mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', displayName: 'Test User' },
    loading: false,
    signOut: vi.fn().mockResolvedValue(undefined),
    refetch: vi.fn(),
    emailVerified: true,
    error: null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/graphql', () => ({
  searchTodos: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/graphql-collab', () => ({
  createListInvite: vi.fn().mockResolvedValue(null),
  createShareLink: vi.fn().mockResolvedValue(null),
  getListShares: vi.fn().mockResolvedValue([]),
  revokeShareLink: vi.fn().mockResolvedValue(true),
  getListMembers: vi.fn().mockResolvedValue([]),
  removeMember: vi.fn().mockResolvedValue(true),
  updateMemberRole: vi.fn().mockResolvedValue(true),
  getPendingInvites: vi.fn().mockResolvedValue([]),
  acceptListInvite: vi.fn().mockResolvedValue(true),
  declineListInvite: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/hooks/useDeleteAccount', () => ({
  useDeleteAccount: () => ({
    deleteAccount: vi.fn().mockResolvedValue(true),
    loading: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: vi.fn().mockReturnValue({ data: null, loading: false, error: null }),
}))

vi.mock('@/hooks/usePresenceHeartbeat', () => ({
  usePresenceHeartbeat: vi.fn(),
}))

vi.mock('@nself/ntask-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nself/ntask-core')>()
  return {
    ...actual,
    SUBSCRIBE_LIST_PRESENCE: 'subscription SubscribePresence { np_list_presence { id } }',
  }
})

vi.mock('@/components/tasks/SearchBar', () => ({
  SearchBar: ({ onResults, onQueryChange }: {
    onResults: (r: unknown[]) => void
    onQueryChange?: (q: string) => void
  }) => (
    <input
      placeholder="Search tasks"
      aria-label="Search tasks"
      onChange={(e) => {
        onQueryChange?.(e.target.value)
        if (e.target.value.length >= 2) onResults([])
      }}
    />
  ),
}))

vi.mock('@/components/collaboration/ListMembersPanel', () => ({
  ListMembersPanel: ({ listId }: { listId: string }) => (
    <div data-testid="members-panel">Members for {listId}</div>
  ),
}))

// ── CommandPalette ────────────────────────────────────────────────────────────

describe('CommandPalette', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the dialog with label', async () => {
    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    render(
      <MemoryRouter>
        <CommandPalette onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('dialog', { name: 'palette.label' })).toBeInTheDocument()
  })

  it('renders search input inside palette', async () => {
    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    render(
      <MemoryRouter>
        <CommandPalette onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('textbox', { name: 'Search tasks' })).toBeInTheDocument()
  })

  it('renders command items by default', async () => {
    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    render(
      <MemoryRouter>
        <CommandPalette onClose={vi.fn()} />
      </MemoryRouter>
    )
    // Commands section should be visible
    expect(screen.getByText('palette.commandsSection')).toBeInTheDocument()
  })

  it('renders keyboard hint bar', async () => {
    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    render(
      <MemoryRouter>
        <CommandPalette onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByText('palette.hintNavigate')).toBeInTheDocument()
    expect(screen.getByText('palette.hintSelect')).toBeInTheDocument()
    expect(screen.getByText('palette.hintClose')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <CommandPalette onClose={onClose} />
      </MemoryRouter>
    )

    const dialog = screen.getByRole('dialog', { name: 'palette.label' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <CommandPalette onClose={onClose} />
      </MemoryRouter>
    )

    // Click the outer backdrop (first fixed div)
    const { container } = render(
      <MemoryRouter>
        <CommandPalette onClose={onClose} />
      </MemoryRouter>
    )
    const backdrop = container.querySelector('.fixed.inset-0')
    if (backdrop) fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalled()
  })

  it('renders in RTL locale without error', async () => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.setAttribute('lang', 'ar')

    const { CommandPalette } = await import('@/components/ui/CommandPalette')
    render(
      <MemoryRouter>
        <CommandPalette onClose={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByRole('dialog', { name: 'palette.label' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')

    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', 'en')
  })
})

// ── RoleSelector ──────────────────────────────────────────────────────────────

describe('RoleSelector', () => {
  it('renders viewer and editor buttons', async () => {
    const { RoleSelector } = await import('@/components/collaboration/RoleSelector')
    render(<RoleSelector value="viewer" onChange={vi.fn()} />)
    expect(screen.getByText('collab.roleViewer')).toBeInTheDocument()
    expect(screen.getByText('collab.roleEditor')).toBeInTheDocument()
  })

  it('viewer button is pressed when value=viewer', async () => {
    const { RoleSelector } = await import('@/components/collaboration/RoleSelector')
    render(<RoleSelector value="viewer" onChange={vi.fn()} />)
    const viewerBtn = screen.getByRole('button', { name: 'collab.roleViewer' })
    expect(viewerBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('editor button is pressed when value=editor', async () => {
    const { RoleSelector } = await import('@/components/collaboration/RoleSelector')
    render(<RoleSelector value="editor" onChange={vi.fn()} />)
    const editorBtn = screen.getByRole('button', { name: 'collab.roleEditor' })
    expect(editorBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange when editor is clicked', async () => {
    const { RoleSelector } = await import('@/components/collaboration/RoleSelector')
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RoleSelector value="viewer" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'collab.roleEditor' }))
    expect(onChange).toHaveBeenCalledWith('editor')
  })

  it('disables buttons when disabled prop is true', async () => {
    const { RoleSelector } = await import('@/components/collaboration/RoleSelector')
    render(<RoleSelector value="viewer" onChange={vi.fn()} disabled />)
    const viewerBtn = screen.getByRole('button', { name: 'collab.roleViewer' })
    expect(viewerBtn).toBeDisabled()
  })

  it('renders role group with label', async () => {
    const { RoleSelector } = await import('@/components/collaboration/RoleSelector')
    render(<RoleSelector value="viewer" onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'collab.roleLabel' })).toBeInTheDocument()
  })
})

// ── InviteBanner ──────────────────────────────────────────────────────────────

describe('InviteBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when no pending invites', async () => {
    const { getPendingInvites } = await import('@/lib/graphql-collab')
    const mock = getPendingInvites as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { InviteBanner } = await import('@/components/collaboration/InviteBanner')
    const { container } = render(<InviteBanner />)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders banner rows for pending invites', async () => {
    const { getPendingInvites } = await import('@/lib/graphql-collab')
    const mock = getPendingInvites as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      {
        id: 'share-1',
        list_id: 'list-1',
        permission: 'viewer',
        invited_by: 'alice@example.com',
        shared_with_email: 'test@example.com',
        accepted_at: null,
        created_at: new Date().toISOString(),
      },
    ])

    const { InviteBanner } = await import('@/components/collaboration/InviteBanner')
    render(<InviteBanner />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('accept button is rendered in banner', async () => {
    const { getPendingInvites } = await import('@/lib/graphql-collab')
    const mock = getPendingInvites as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([
      {
        id: 'share-1',
        list_id: 'list-1',
        permission: 'editor',
        invited_by: 'bob@example.com',
        shared_with_email: 'test@example.com',
        accepted_at: null,
        created_at: new Date().toISOString(),
      },
    ])

    const { InviteBanner } = await import('@/components/collaboration/InviteBanner')
    render(<InviteBanner />)

    await waitFor(() => {
      expect(screen.getByText('collab.accept')).toBeInTheDocument()
      expect(screen.getByText('collab.decline')).toBeInTheDocument()
    })
  })
})

// ── PresenceAvatarStack ───────────────────────────────────────────────────────

describe('PresenceAvatarStack', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders null when no subscription data', async () => {
    const { PresenceAvatarStack } = await import('@/components/collaboration/PresenceAvatarStack')
    const { container } = render(<PresenceAvatarStack listId="list-1" />)
    // No subscription data → presences.length = 0 ≤ 1 → null
    expect(container.firstChild).toBeNull()
  })

  it('renders null when only one presence (current user alone)', async () => {
    const { useSubscription } = await import('@/hooks/useSubscription')
    const mockUseSubscription = useSubscription as ReturnType<typeof vi.fn>
    mockUseSubscription.mockReturnValueOnce({
      data: {
        np_list_presence: [
          { id: 'p-1', user_id: 'user-1', list_id: 'list-1', profile: { display_name: 'Alice' } },
        ],
      },
      loading: false,
      error: null,
    })

    const { PresenceAvatarStack } = await import('@/components/collaboration/PresenceAvatarStack')
    const { container } = render(<PresenceAvatarStack listId="list-1" />)
    // ≤1 presence → null
    expect(container.firstChild).toBeNull()
  })

  it('renders avatar group when multiple users are present', async () => {
    const { useSubscription } = await import('@/hooks/useSubscription')
    const mockUseSubscription = useSubscription as ReturnType<typeof vi.fn>
    mockUseSubscription.mockReturnValueOnce({
      data: {
        np_list_presence: [
          { id: 'p-1', user_id: 'user-1', list_id: 'list-1', profile: { display_name: 'Alice' } },
          { id: 'p-2', user_id: 'user-2', list_id: 'list-1', profile: { display_name: 'Bob' } },
        ],
      },
      loading: false,
      error: null,
    })

    const { PresenceAvatarStack } = await import('@/components/collaboration/PresenceAvatarStack')
    render(<PresenceAvatarStack listId="list-1" />)

    expect(screen.getByRole('group', { name: 'collab.presence' })).toBeInTheDocument()
  })
})

// ── ShareListDialog ───────────────────────────────────────────────────────────

describe('ShareListDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders tabs: Invite, Link, Members', async () => {
    const { getListShares } = await import('@/lib/graphql-collab')
    const mock = getListShares as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { ShareListDialog } = await import('@/components/collaboration/ShareListDialog')
    render(<ShareListDialog listId="list-1" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('collab.tabInvite')).toBeInTheDocument()
      expect(screen.getByText('collab.tabLink')).toBeInTheDocument()
      expect(screen.getByText('collab.tabMembers')).toBeInTheDocument()
    })
  })

  it('renders invite form by default', async () => {
    const { getListShares } = await import('@/lib/graphql-collab')
    const mock = getListShares as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { ShareListDialog } = await import('@/components/collaboration/ShareListDialog')
    render(<ShareListDialog listId="list-1" onClose={vi.fn()} />)

    await waitFor(() => {
      // Invite tab is default — email input should be visible
      expect(screen.getByRole('textbox', { name: /collab\.emailLabel/i })).toBeInTheDocument()
    })
  })

  it('shows members panel when members tab is clicked', async () => {
    const { getListShares } = await import('@/lib/graphql-collab')
    const mock = getListShares as ReturnType<typeof vi.fn>
    mock.mockResolvedValueOnce([])

    const { ShareListDialog } = await import('@/components/collaboration/ShareListDialog')
    const user = userEvent.setup()
    render(<ShareListDialog listId="list-1" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('collab.tabMembers')).toBeInTheDocument()
    })

    await user.click(screen.getByText('collab.tabMembers'))

    await waitFor(() => {
      expect(screen.getByTestId('members-panel')).toBeInTheDocument()
    })
  })
})

// ── DeleteAccountModal ────────────────────────────────────────────────────────

describe('DeleteAccountModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the modal dialog', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders confirm input', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('textbox', { name: /delete-confirm/i })).toBeInTheDocument()
  })

  it('delete button is disabled when confirm text does not match', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={vi.fn()} />
      </MemoryRouter>
    )
    const deleteBtn = screen.getByText('settings.deleteAccount.confirm')
    expect(deleteBtn).toBeDisabled()
  })

  it('delete button becomes enabled when "DELETE" is typed', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={vi.fn()} />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('DELETE')
    await user.type(input, 'DELETE')

    const deleteBtn = screen.getByText('settings.deleteAccount.confirm')
    expect(deleteBtn).not.toBeDisabled()
  })

  it('calls onClose when cancel is clicked', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={onClose} />
      </MemoryRouter>
    )

    await user.click(screen.getByText('createTask.cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders danger heading', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByText('settings.deleteAccount.title')).toBeInTheDocument()
  })

  it('renders warning items', async () => {
    const { DeleteAccountModal } = await import('@/components/account/DeleteAccountModal')
    render(
      <MemoryRouter>
        <DeleteAccountModal onClose={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByText('settings.deleteAccount.item1')).toBeInTheDocument()
    expect(screen.getByText('settings.deleteAccount.item2')).toBeInTheDocument()
  })
})
