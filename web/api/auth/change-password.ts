/**
 * api/auth/change-password.ts — POST /api/auth/change-password
 *
 * Purpose:    Proxy the changePassword Hasura Action, forwarding the caller's
 *             session cookie as a Bearer token to Hasura GraphQL.
 * Inputs:     { currentPassword, newPassword } JSON body; session cookie
 * Outputs:    { success, message } on success; 400/401/500 on error
 * Constraints: Vercel Function; mirrors api/auth/login.ts cookie pattern.
 *             Backend action ignores currentPassword (re-auth is built into
 *             JWT validation) — accepted here only to match the
 *             AccountTab.tsx request body, never forwarded.
 * SOT:        J-S2-T2 — changePassword Hasura Action (backend/hasura/metadata/actions.graphql)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GRAPHQL_URL =
  process.env.GRAPHQL_INTERNAL_URL ||
  process.env.VITE_GRAPHQL_URL ||
  'http://localhost:8080/v1/graphql'

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

const CHANGE_PASSWORD_MUTATION = /* GraphQL */ `
  mutation ChangePassword($newPassword: String!) {
    changePassword(newPassword: $newPassword) {
      success
      message
    }
  }
`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = parseCookies(req.headers.cookie as string | undefined)[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const { newPassword } = req.body as { currentPassword?: string; newPassword?: string }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const graphqlResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: CHANGE_PASSWORD_MUTATION,
        variables: { newPassword },
      }),
    })

    const data = (await graphqlResponse.json()) as {
      data?: { changePassword?: { success: boolean; message: string } }
      errors?: Array<{ message: string }>
    }

    if (data.errors?.length) {
      const msg = data.errors[0]?.message ?? 'Password change failed'
      const unauthorized = /session expired|401/i.test(msg)
      return res.status(unauthorized ? 401 : 400).json({ error: msg })
    }
    if (!graphqlResponse.ok || !data.data?.changePassword) {
      return res.status(graphqlResponse.status || 500).json({ error: 'Password change failed' })
    }

    return res.status(200).json(data.data.changePassword)
  } catch (error) {
    console.error('change-password error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
