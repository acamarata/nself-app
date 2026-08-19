/**
 * api/auth/logout.ts — POST /api/auth/logout
 *
 * Purpose:    Revoke auth token on nHasura Auth service and clear session cookie.
 * Inputs:     session cookie (nself_auth_token)
 * Outputs:    200 on success; 500 on error
 * Constraints: Vercel Function
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const AUTH_URL =
  process.env.AUTH_INTERNAL_URL ||
  process.env.VITE_AUTH_URL ||
  'http://localhost:4000'

const COOKIE_NAME = 'nself_auth_token'

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=').trim()]
    }),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const cookies = parseCookies(req.headers.cookie as string | undefined)
    const token = cookies[COOKIE_NAME]

    if (token) {
      try {
        await fetch(`${AUTH_URL}/signout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        console.error('Auth service signout error:', err)
      }
    }

    // Clear the cookie
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    )
    return res.status(200).json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
