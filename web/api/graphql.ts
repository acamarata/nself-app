/**
 * api/graphql.ts — POST /api/graphql
 *
 * Purpose:    Proxy GraphQL requests to Hasura, injecting auth token from cookie.
 * Inputs:     GraphQL { query, variables } body; session cookie
 * Outputs:    Proxied Hasura response
 * Constraints: Vercel Function; httpOnly cookie pattern
 * SOT:        T-P3-E3 — web/ntask Vite migration
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const cookies = parseCookies(req.headers.cookie as string | undefined)
    const token = cookies[COOKIE_NAME]

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const graphqlResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    })

    const data = await graphqlResponse.json()
    return res.status(graphqlResponse.status).json(data)
  } catch (error) {
    console.error('GraphQL proxy error:', error)
    return res.status(500).json({
      errors: [{ message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
    })
  }
}
