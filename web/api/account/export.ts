/**
 * api/account/export.ts — GET /api/account/export
 *
 * Purpose:    Proxy the requestDataExport Hasura Action, forwarding the
 *             caller's session cookie as a Bearer token to Hasura GraphQL.
 * Inputs:     session cookie (nself_auth_token); no body
 * Outputs:    { url: string } on success; 401/429/500 on error
 * Constraints: Vercel Function; mirrors api/auth/login.ts cookie pattern.
 *             Rate-limited server-side to 1 request/24h per user — the
 *             action throws with extensions.code === 'EXPORT_RATE_LIMITED',
 *             which this route maps to HTTP 429 for useDataExport.ts.
 * SOT:        J-S3-T2 — requestDataExport Hasura Action (backend/hasura/metadata/actions.graphql)
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

const REQUEST_DATA_EXPORT_MUTATION = /* GraphQL */ `
  mutation RequestDataExport {
    requestDataExport {
      downloadUrl
      expiresAt
    }
  }
`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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
      body: JSON.stringify({ query: REQUEST_DATA_EXPORT_MUTATION }),
    })

    const data = (await graphqlResponse.json()) as {
      data?: { requestDataExport?: { downloadUrl: string; expiresAt: string } }
      errors?: Array<{ message: string; extensions?: { code?: string } }>
    }

    if (data.errors?.length) {
      const rateLimited = data.errors.some((e) => e.extensions?.code === 'EXPORT_RATE_LIMITED')
      if (rateLimited) {
        return res.status(429).json({ error: 'rate_limited' })
      }
      return res.status(400).json({ error: data.errors[0]?.message ?? 'Export request failed' })
    }
    if (!graphqlResponse.ok || !data.data?.requestDataExport) {
      return res.status(graphqlResponse.status || 500).json({ error: 'Export request failed' })
    }

    return res.status(200).json({ url: data.data.requestDataExport.downloadUrl })
  } catch (error) {
    console.error('account export error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
