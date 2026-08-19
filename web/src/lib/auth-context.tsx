/**
 * auth-context.tsx — AuthContext, AuthProvider, useAuth hook
 *
 * Purpose:    Single source of auth state. Calls getUser once on mount.
 *             Eliminates per-component auth.getUser() race conditions.
 * Inputs:     auth.getUser() from api.ts; optional signOut
 * Outputs:    user, loading, emailVerified, refetch, signOut
 * Constraints: React 19; must be mounted inside BrowserRouter
 * SPORT:      D-S3-T1 — AuthContext unification
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { auth } from './api'

interface AuthUser {
  id: string
  email: string
  displayName?: string
  emailVerified?: boolean
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  emailVerified: boolean
  refetch: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await auth.getUser()
    if (result.error || !result.data) {
      setUser(null)
      setError(result.error?.message ?? 'Not authenticated')
    } else {
      setUser(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  const signOut = useCallback(async () => {
    await auth.signOut()
    setUser(null)
    setError(null)
  }, [])

  const emailVerified = user?.emailVerified !== false // default true unless explicitly false

  return (
    <AuthContext.Provider value={{ user, loading, error, emailVerified, refetch: fetchUser, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
