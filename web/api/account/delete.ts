/**
 * api/account/delete.ts — POST /api/account/delete
 *
 * Purpose:    Proxy the deleteMyAccount Hasura Action, forwarding the caller's
 *             session cookie as a Bearer token to Hasura GraphQL. Irreversible.
 * Inputs:     session cookie (nself_auth_token); no body
 * Outputs:    { success, deletedAt } on success; 401/500 on error
 * Constraints: Vercel Function; mirrors api/auth/login.ts cookie pattern.
 *             Clears the session cookie on success since the account no
 *             longer exists to authenticate against.
 * SOT:        J-S3-T1 — deleteMyAccount Hasura Action (backend/hasura/metadata/actions.graphql)
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

const DELETE_MY_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation DeleteMyAccount {
    deleteMyAccount {
      success
      deletedAt
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

  try {
    const graphqlResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: DELETE_MY_ACCOUNT_MUTATION }),
    })

    const data = (await graphqlResponse.json()) as {
      data?: { deleteMyAccount?: { success: boolean; deletedAt: string } }
      errors?: Array<{ message: string }>
    }

    if (data.errors?.length) {
      return res.status(400).json({ error: data.errors[0]?.message ?? 'Account deletion failed' })
    }
    if (!graphqlResponse.ok || !data.data?.deleteMyAccount) {
      return res.status(graphqlResponse.status || 500).json({ error: 'Account deletion failed' })
    }

    // Account no longer exists — clear the session cookie.
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
    return res.status(200).json(data.data.deleteMyAccount)
  } catch (error) {
    console.error('account delete error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
