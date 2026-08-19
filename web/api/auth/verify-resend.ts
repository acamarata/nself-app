/**
 * verify-resend.ts — POST /api/auth/verify-resend
 *
 * Purpose:    Resend email verification to current session user.
 * SPORT:      D-S3-T3
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUrl = process.env['AUTH_INTERNAL_URL'] ?? 'http://localhost:4000'
  const cookie = req.headers['cookie'] ?? ''

  try {
    const response = await fetch(`${authUrl}/user/email/send-verification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    })
    if (!response.ok) {
      const data = await response.json() as Record<string, unknown>
      return res.status(response.status).json({ error: data['message'] ?? 'Failed to resend' })
    }
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
