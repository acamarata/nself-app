/**
 * API Client for ɳTask
 * Uses httpOnly cookie auth pattern (same as cloud app).
 * All GraphQL goes through /api/graphql proxy to attach token from cookie.
 */

export interface ApiResponse<T> {
  data?: T
  error?: {
    message: string
    code?: string
    status?: number
  }
}

export interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    extensions?: { code?: string }
  }>
}

async function fetchWithCredentials(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })
}

export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithCredentials('/api/graphql', {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    })
    const json: GraphQLResponse<T> = await response.json()

    if (json.errors && json.errors.length > 0) {
      return {
        error: {
          message: json.errors[0].message,
          code: json.errors[0].extensions?.code,
          status: response.status,
        },
      }
    }
    return { data: json.data }
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'Network error', code: 'NETWORK_ERROR' } }
  }
}

// In Vite SPA the code always runs in the browser — no server-side execution.
const AUTH_URL_CLIENT =
  import.meta.env.VITE_AUTH_URL || 'https://auth.local.nself.org'

export const auth = {
  async signIn(email: string, password: string): Promise<ApiResponse<{ user: { id: string; email: string } }>> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const json = await response.json()
      if (!response.ok) return { error: { message: json.error || 'Sign in failed', status: response.status } }
      return { data: { user: json.user } }
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Network error', code: 'NETWORK_ERROR' } }
    }
  },

  async signUp(
    email: string,
    password: string,
    options?: { displayName?: string }
  ): Promise<ApiResponse<{ session: unknown }>> {
    try {
      const response = await fetch(`${AUTH_URL_CLIENT}/signup/email-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, options: { displayName: options?.displayName } }),
      })
      const json = await response.json()
      if (!response.ok) return { error: { message: json.message || 'Sign up failed', status: response.status } }
      return { data: json }
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Network error', code: 'NETWORK_ERROR' } }
    }
  },

  async signOut(): Promise<ApiResponse<void>> {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      return { data: undefined }
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Network error', code: 'NETWORK_ERROR' } }
    }
  },

  async getUser(): Promise<ApiResponse<{ id: string; email: string; displayName?: string }>> {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' })
      const json = await response.json()
      if (!response.ok || !json.authenticated) {
        return { error: { message: 'Not authenticated', status: response.status } }
      }
      return { data: json.user }
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Network error', code: 'NETWORK_ERROR' } }
    }
  },
}

const api = { gql, auth }
export default api
