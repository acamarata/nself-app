/**
 * api/auth/login.ts — POST /api/auth/login
 *
 * Purpose:    Authenticate user against nHasura Auth service; set httpOnly session cookie.
 * Inputs:     { email, password } JSON body
 * Outputs:    { user } on success; 400/401/500 on error
 * Constraints: Vercel Function; cookie set server-side for security
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const AUTH_URL =
  process.env.AUTH_INTERNAL_URL ||
  process.env.VITE_AUTH_URL ||
  'http://localhost:4000'

const COOKIE_NAME = 'nself_auth_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const authResponse = await fetch(`${AUTH_URL}/signin/email-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    }).catch((e) => {
      throw new Error(`auth service unreachable at ${AUTH_URL}: ${e?.message || e}`)
    })

    const authData = await authResponse.json() as {
      session?: { accessToken?: string; user?: unknown }
      message?: string
    }

    if (!authResponse.ok) {
      return res
        .status(authResponse.status)
        .json({ error: authData.message || 'Authentication failed' })
    }

    const accessToken = authData.session?.accessToken
    if (!accessToken) {
      return res.status(500).json({ error: 'No access token received' })
    }

    const secure = process.env.NODE_ENV === 'production'
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}${secure ? '; Secure' : ''}`,
    )

    return res.status(200).json({ user: authData.session?.user, message: 'Authentication successful' })
  } catch (error) {
    console.error('Login error:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    const unreachable = /unreachable|aborted|timeout|ECONNREFUSED|fetch failed/i.test(msg)
    return res.status(unreachable ? 503 : 500).json({ error: unreachable ? 'Auth service is not available yet. Please try again later.' : 'Internal server error' })
  }
}
