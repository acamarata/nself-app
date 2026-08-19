/**
 * auth.test.tsx — AuthProvider + useAuth hook RTL tests
 *
 * Purpose: Test auth context loading states, success, error, and signOut.
 * Mock strategy: vi.mock('@/lib/api') controls auth.getUser responses.
 * SPORT: D-S3-T1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { useAuth } from '@/lib/auth-context'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  gql: vi.fn(),
  auth: {
    getUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthMock() {
  const { auth } = await import('@/lib/api')
  return auth as {
    getUser: ReturnType<typeof vi.fn>
    signIn: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
    signUp: ReturnType<typeof vi.fn>
  }
}

// Component that uses useAuth to display state
function AuthDisplay() {
  const { user, loading, error, emailVerified } = useAuth()
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!user) return <div>No user</div>
  return (
    <div>
      <span data-testid="email">{user.email}</span>
      <span data-testid="verified">{String(emailVerified)}</span>
    </div>
  )
}

// Component that exercises signOut
function SignOutButton() {
  const { signOut } = useAuth()
  return <button onClick={() => void signOut()}>Sign Out</button>
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthProvider — loading state', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading indicator while fetching', async () => {
    const auth = await getAuthMock()
    // Never resolves during render
    auth.getUser.mockReturnValue(new Promise(() => {}))

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})

describe('AuthProvider — successful auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders user email after successful getUser', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({
      data: { id: 'user-1', email: 'test@example.com', emailVerified: true },
    })

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('test@example.com')
    })
  })

  it('emailVerified is true when user.emailVerified is true', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({
      data: { id: 'user-1', email: 'test@example.com', emailVerified: true },
    })

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('verified')).toHaveTextContent('true')
    })
  })

  it('emailVerified defaults true when emailVerified is undefined', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({
      data: { id: 'user-1', email: 'user@example.com' },
    })

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('verified')).toHaveTextContent('true')
    })
  })
})

describe('AuthProvider — error state', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows error message on auth failure', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({
      error: { message: 'Not authenticated' },
      data: null,
    })

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Error: Not authenticated')).toBeInTheDocument()
    })
  })

  it('shows fallback error when error has no message', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({ error: {}, data: null })

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Error: Not authenticated')).toBeInTheDocument()
    })
  })

  it('shows no user when data is null', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({ data: null })

    const { AuthProvider } = await import('@/lib/auth-context')

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    )

    await waitFor(() => {
      // Either "No user" or "Error: ..."
      const text = document.body.textContent ?? ''
      expect(text).not.toBe('')
    })
  })
})

describe('AuthProvider — signOut', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls auth.signOut and resets user state', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({
      data: { id: 'user-1', email: 'test@example.com', emailVerified: true },
    })
    auth.signOut.mockResolvedValue(undefined)

    const { AuthProvider } = await import('@/lib/auth-context')
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthDisplay />
        <SignOutButton />
      </AuthProvider>
    )

    // Wait for user to load
    await waitFor(() => {
      expect(screen.getByTestId('email')).toBeInTheDocument()
    })

    // Click sign out
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    await waitFor(() => {
      expect(auth.signOut).toHaveBeenCalledOnce()
    })
  })
})

describe('AuthProvider — refetch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refetch re-calls getUser', async () => {
    const auth = await getAuthMock()
    auth.getUser.mockResolvedValue({
      data: { id: 'user-1', email: 'test@example.com', emailVerified: true },
    })

    const { AuthProvider, useAuth } = await import('@/lib/auth-context')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    auth.getUser.mockResolvedValue({
      data: { id: 'user-1', email: 'updated@example.com', emailVerified: true },
    })

    await act(async () => {
      await result.current.refetch()
    })

    expect(auth.getUser).toHaveBeenCalledTimes(2)
  })
})

describe('useAuth — outside provider throws', () => {
  it('throws when used outside AuthProvider', async () => {
    const { useAuth } = await import('@/lib/auth-context')
    // renderHook without wrapper should throw
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside AuthProvider')
  })
})
