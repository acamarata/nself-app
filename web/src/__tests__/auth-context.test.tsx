/**
 * auth-context.test.tsx — Unit tests for AuthContext provider and useAuth hook
 *
 * Purpose:    Verify AuthProvider renders loading/auth/unauth states and that
 *             useAuth throws when used outside the provider.
 * Inputs:     Mocked auth.getUser() via vi.mock('../lib/api')
 * Constraints: jsdom; BrowserRouter required for react-router-dom context
 * SPORT:      D-S10-T1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../lib/auth-context'

// Mock the api module so auth.getUser() is fully controlled per test
vi.mock('../lib/api', () => ({
  auth: {
    getUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  },
  gql: vi.fn(),
}))

import { auth } from '../lib/api'
const mockGetUser = vi.mocked(auth.getUser)

function TestConsumer() {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  return <div>{user ? `Hello ${user.email}` : 'Not authenticated'}</div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    // Never resolves — stays in loading
    mockGetUser.mockReturnValue(new Promise(() => {}))
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrowserRouter>
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows user email when authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { id: '1', email: 'test@example.com' },
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Hello test@example.com')).toBeInTheDocument()
    })
  })

  it('shows unauthenticated state when getUser returns error', async () => {
    mockGetUser.mockResolvedValueOnce({
      error: { message: 'Not authenticated', status: 401 },
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })
  })

  it('calls getUser exactly once on mount', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { id: '1', email: 'test@example.com' },
    })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Hello test@example.com')).toBeInTheDocument()
    })

    expect(mockGetUser).toHaveBeenCalledTimes(1)
  })

  it('throws when useAuth used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <BrowserRouter>
          <TestConsumer />
        </BrowserRouter>
      )
    ).toThrow('useAuth must be used inside AuthProvider')
    spy.mockRestore()
  })
})
