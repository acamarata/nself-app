/**
 * reset.ts — POST /api/auth/reset — send password reset email
 *
 * Purpose:    Proxy password reset request to nHasura Auth service.
 * Inputs:     { email: string }
 * Outputs:    200 on success
 * Constraints: Server-side only (Vercel Function); AUTH_INTERNAL_URL required
 * SPORT:      D-S3-T2
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body as { email?: string }
  if (!email) return res.status(400).json({ error: 'Email required' })

  const authUrl = process.env['AUTH_INTERNAL_URL'] ?? 'http://localhost:4000'

  try {
    const response = await fetch(`${authUrl}/user/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await response.json() as Record<string, unknown>
    if (!response.ok) return res.status(response.status).json({ error: data['message'] ?? 'Reset failed' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
