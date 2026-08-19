/**
 * coverage-boost-1.test.tsx — Coverage for AccountTab, NotificationCenterPopover,
 *                              CreateTaskDialog, HomePage
 * SPORT: J-S1-T1, J-S1-T2, T-P5-E1-notifications, D2-S7-T1, D-S7-T1
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Global mocks (hoisted) ───────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
  useT: () => (key: string) => key,
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'ar'],
}))

vi.mock('@/hooks/useDataExport', () => ({
  useDataExport: () => ({
    requestExport: vi.fn().mockResolvedValue(null),
    loading: false,
    error: null,
  }),
}))

vi.mock('@/pages/app/settings/PrivacyLinksSection', () => ({
  PrivacyLinksSection: () => <div data-testid="privacy-links" />,
}))

vi.mock('@/components/account/DeleteAccountModal', () => ({
  DeleteAccountModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="delete-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('@nself/ntask-core', () => ({
  SUBSCRIBE_UNREAD_NOTIFICATION_COUNT: 'SUB_COUNT',
  SUBSCRIBE_NOTIFICATIONS: 'SUB_NOTIFS',
}))

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ data: null }),
}))

vi.mock('@/lib/graphql-collab', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(true),
  markAllNotificationsRead: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/graphql', () => ({
  createTodo: vi.fn().mockResolvedValue(null),
  getLists: vi.fn().mockResolvedValue([]),
  getAllTodos: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}))

// ── AccountTab ───────────────────────────────────────────────────────────────

describe('AccountTab', () => {
  it('renders email, change password, data export, danger zone, sign out', async () => {
    const { AccountTab } = await import('@/pages/app/settings/AccountTab')
    const { container } = render(
      <AccountTab userEmail="user@example.com" onSignOut={async () => {}} />,
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
    expect(screen.getByTestId('privacy-links')).toBeInTheDocument()
  })

  it('shows delete modal when delete button clicked', async () => {
    const { AccountTab } = await import('@/pages/app/settings/AccountTab')
    render(<AccountTab userEmail="user@example.com" onSignOut={async () => {}} />)
    const deleteBtn = screen.getByText('settings.deleteAccount.button')
    fireEvent.click(deleteBtn)
    await waitFor(() => expect(screen.getByTestId('delete-modal')).toBeInTheDocument())
  })

  it('hides delete modal when modal close callback fires', async () => {
    const { AccountTab } = await import('@/pages/app/settings/AccountTab')
    render(<AccountTab userEmail="user@example.com" onSignOut={async () => {}} />)
    fireEvent.click(screen.getByText('settings.deleteAccount.button'))
    await waitFor(() => expect(screen.getByTestId('delete-modal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument())
  })

  it('calls onSignOut when sign out button clicked', async () => {
    const { AccountTab } = await import('@/pages/app/settings/AccountTab')
    const onSignOut = vi.fn().mockResolvedValue(undefined)
    render(<AccountTab userEmail="user@example.com" onSignOut={onSignOut} />)
    fireEvent.click(screen.getByText('settings.signOut'))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('toggles change-email form open and closed', async () => {
    const { AccountTab } = await import('@/pages/app/settings/AccountTab')
    render(<AccountTab userEmail="user@example.com" onSignOut={async () => {}} />)
    // There are two "settings.change" buttons (email + password); first is email
    const changeButtons = screen.getAllByText('settings.change')
    fireEvent.click(changeButtons[0])
    await waitFor(() =>
      expect(screen.getByLabelText('settings.changeEmail.currentPassword')).toBeInTheDocument(),
    )
    // clicking again collapses
    fireEvent.click(changeButtons[0])
    await waitFor(() =>
      expect(screen.queryByLabelText('settings.changeEmail.currentPassword')).not.toBeInTheDocument(),
    )
  })

  it('toggles change-password form open and closed', async () => {
    const { AccountTab } = await import('@/pages/app/settings/AccountTab')
    render(<AccountTab userEmail="user@example.com" onSignOut={async () => {}} />)
    const changeButtons = screen.getAllByText('settings.change')
    fireEvent.click(changeButtons[1])
    await waitFor(() =>
      expect(screen.getByLabelText('settings.changePassword.current')).toBeInTheDocument(),
    )
  })
})

// ── NotificationCenterPopover ────────────────────────────────────────────────

describe('NotificationCenterPopover', () => {
  it('renders bell button without badge when no unread notifications', async () => {
    const { NotificationCenterPopover } = await import(
      '@/components/notifications/NotificationCenterPopover'
    )
    const { container } = render(
      <MemoryRouter>
        <NotificationCenterPopover userId="user-1" />
      </MemoryRouter>,
    )
    expect(container.firstChild).not.toBeNull()
    const btn = screen.getByRole('button', { name: 'notifications.bell' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens popover on bell click and shows empty state', async () => {
    const { NotificationCenterPopover } = await import(
      '@/components/notifications/NotificationCenterPopover'
    )
    render(
      <MemoryRouter>
        <NotificationCenterPopover userId="user-1" />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: 'notifications.bell' })
    fireEvent.click(btn)
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.getByText('notifications.empty')).toBeInTheDocument(),
    )
  })

  it('closes popover on second bell click', async () => {
    const { NotificationCenterPopover } = await import(
      '@/components/notifications/NotificationCenterPopover'
    )
    render(
      <MemoryRouter>
        <NotificationCenterPopover userId="user-1" />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: 'notifications.bell' })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(btn)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes popover on Escape key', async () => {
    const { NotificationCenterPopover } = await import(
      '@/components/notifications/NotificationCenterPopover'
    )
    render(
      <MemoryRouter>
        <NotificationCenterPopover userId="user-1" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'notifications.bell' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('popover heading is visible after opening', async () => {
    const { NotificationCenterPopover } = await import(
      '@/components/notifications/NotificationCenterPopover'
    )
    render(
      <MemoryRouter>
        <NotificationCenterPopover userId="user-1" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'notifications.bell' }))
    await waitFor(() =>
      expect(screen.getByText('notifications.title')).toBeInTheDocument(),
    )
  })
})

// ── CreateTaskDialog ─────────────────────────────────────────────────────────

describe('CreateTaskDialog', () => {
  const noop = () => {}

  it('renders dialog with title, notes, priority, due date fields', async () => {
    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog')
    const { container } = render(
      <CreateTaskDialog onCreated={noop} onClose={noop} />,
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('createTask.title')).toBeInTheDocument()
    expect(screen.getByLabelText('createTask.notes')).toBeInTheDocument()
    expect(screen.getByLabelText('createTask.priority')).toBeInTheDocument()
    expect(screen.getByLabelText('createTask.dueDate')).toBeInTheDocument()
  })

  it('renders with prefillTitle set as initial value', async () => {
    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog')
    render(
      <CreateTaskDialog prefillTitle="My Task" onCreated={noop} onClose={noop} />,
    )
    expect((screen.getByLabelText('createTask.title') as HTMLInputElement).value).toBe('My Task')
  })

  it('calls onClose when cancel button clicked', async () => {
    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog')
    const onClose = vi.fn()
    render(
      <CreateTaskDialog onCreated={noop} onClose={onClose} />,
    )
    fireEvent.click(screen.getByText('createTask.cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop clicked', async () => {
    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog')
    const onClose = vi.fn()
    render(
      <CreateTaskDialog onCreated={noop} onClose={onClose} />,
    )
    // backdrop is an aria-hidden div; click it via the aria-hidden element
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('submit button is disabled when title is empty', async () => {
    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog')
    render(
      <CreateTaskDialog onCreated={noop} onClose={noop} />,
    )
    const submitBtn = screen.getByText('createTask.create')
    expect(submitBtn).toBeDisabled()
  })

  it('shows error when createTodo returns null', async () => {
    const graphqlMod = await import('@/lib/graphql')
    vi.mocked(graphqlMod.createTodo).mockResolvedValueOnce(null)

    const { CreateTaskDialog } = await import('@/components/tasks/CreateTaskDialog')
    render(
      <CreateTaskDialog onCreated={noop} onClose={noop} />,
    )
    const titleInput = screen.getByLabelText('createTask.title')
    fireEvent.change(titleInput, { target: { value: 'Test task' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

// ── HomePage ─────────────────────────────────────────────────────────────────

describe('HomePage', () => {
  it('renders hero heading', async () => {
    const { HomePage } = await import('@/pages/HomePage')
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByText('home.heroTitleHighlight')).toBeInTheDocument()
  })

  it('renders CTA links to /login and /signup', async () => {
    const { HomePage } = await import('@/pages/HomePage')
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('home.signUpFree').length).toBeGreaterThan(0)
    expect(screen.getByText('home.logIn')).toBeInTheDocument()
  })

  it('renders feature highlight items', async () => {
    const { HomePage } = await import('@/pages/HomePage')
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('home.features.listsSubtasks.title')).toBeInTheDocument()
    expect(screen.getByText('home.features.dueDatesReminders.title')).toBeInTheDocument()
    expect(screen.getByText('home.features.offlineFirst.title')).toBeInTheDocument()
  })

  it('renders feature cards from the features array', async () => {
    const { HomePage } = await import('@/pages/HomePage')
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('home.features.recurringTasks.title')).toBeInTheDocument()
    expect(screen.getByText('home.features.tagsFilterSearch.title')).toBeInTheDocument()
    expect(screen.getByText('home.features.shareCollaborate.title')).toBeInTheDocument()
  })

  it('renders self-host steps', async () => {
    const { HomePage } = await import('@/pages/HomePage')
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('home.platformsHeading')).toBeInTheDocument()
    expect(screen.getByText('home.platforms.web.name')).toBeInTheDocument()
    expect(screen.getByText('home.selfHostLinkText')).toBeInTheDocument()
  })
})
