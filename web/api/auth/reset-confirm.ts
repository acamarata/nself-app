/**
 * api/auth/reset-confirm.ts — POST /api/auth/reset-confirm — set a new password
 *
 * Purpose:    Complete a password reset for a user arriving from a reset email.
 * Inputs:     { refreshToken: string, newPassword: string }
 * Outputs:    200 { ok: true }; 400 on bad input; upstream status on failure
 * Constraints: Vercel Function. The refresh token is single-use and is spent here.
 * SPORT:      D-S3-T2
 *
 * WHY this takes a refreshToken rather than a ticket:
 * hasura-auth owns the ticket. The link in the reset email points at the auth
 * service's own /verify endpoint, which validates and CONSUMES the ticket, then
 * redirects the browser to AUTH_CLIENT_URL with ?refreshToken=<uuid>&type=passwordReset.
 * By the time any of our code runs, the ticket is already spent and the browser
 * holds a refresh token instead.
 *
 * This handler previously accepted a ticket and posted it to
 * /user/password/reset/confirm, an endpoint that does not exist in hasura-auth
 * 0.36 (it answers 404). Password reset could not have worked; the request never
 * reached a real endpoint, and the page it was called from was reading a query
 * parameter the auth service never sends.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const AUTH_URL =
  process.env.AUTH_INTERNAL_URL ||
  process.env.VITE_AUTH_URL ||
  'http://localhost:4000'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { refreshToken, newPassword } = req.body as {
    refreshToken?: string
    newPassword?: string
  }
  if (!refreshToken || !newPassword) {
    return res.status(400).json({ error: 'refreshToken and newPassword are required' })
  }

  try {
    // Spend the refresh token for a short-lived access token.
    const tokenRes = await fetch(`${AUTH_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(8000),
    })
    const tokenData = (await tokenRes.json()) as {
      session?: { accessToken?: string }
      accessToken?: string
      message?: string
    }
    if (!tokenRes.ok) {
      // A reset link that was already used or has expired lands here. Say so
      // plainly rather than surfacing the upstream wording, which talks about
      // refresh tokens the user never saw.
      return res.status(401).json({ error: 'This reset link has expired or was already used.' })
    }

    const accessToken = tokenData.session?.accessToken ?? tokenData.accessToken
    if (!accessToken) return res.status(502).json({ error: 'Auth service returned no access token' })

    const pwRes = await fetch(`${AUTH_URL}/user/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ newPassword }),
      signal: AbortSignal.timeout(8000),
    })
    if (!pwRes.ok) {
      const data = (await pwRes.json().catch(() => ({}))) as { message?: string; error?: string }
      return res
        .status(pwRes.status)
        .json({ error: data.message ?? data.error ?? 'Could not set the new password' })
    }

    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
