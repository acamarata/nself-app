/**
 * api/auth/session.ts — GET /api/auth/session
 *
 * Purpose:    Validate the session cookie by verifying the JWT locally
 *             (HS256 signature + expiry) rather than calling the auth service's
 *             /user endpoint, which is unreliable across environments.
 * Inputs:     session cookie (nself_auth_token)
 * Outputs:    { authenticated: true, user } or { authenticated: false }
 * Constraints: Vercel Function. Stateless — no network call. Requires the JWT
 *              signing secret (HASURA_GRAPHQL_JWT_SECRET, JSON {type,key}, or a
 *              raw key) in the function environment.
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const COOKIE_NAME = 'nself_auth_token'
const HASURA_CLAIMS = 'https://hasura.io/jwt/claims'

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=').trim()]
    }),
  )
}

/** Resolve the HS256 signing key from HASURA_GRAPHQL_JWT_SECRET (JSON {type,key}) or a raw key. */
function signingKey(): string | null {
  if (process.env.AUTH_HS256_KEY) return process.env.AUTH_HS256_KEY
  const raw = process.env.HASURA_GRAPHQL_JWT_SECRET || process.env.AUTH_JWT_SECRET
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed.key || parsed.jwk || null
  } catch {
    return raw
  }
}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** Verify an HS256 JWT (signature + exp). Returns the payload or null. */
function verifyHs256(token: string, key: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts
  const expected = crypto.createHmac('sha256', key).update(`${header}.${payload}`).digest()
  const got = b64urlToBuf(sig)
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null
  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(b64urlToBuf(payload).toString('utf8'))
  } catch {
    return null
  }
  const exp = typeof claims.exp === 'number' ? claims.exp : 0
  if (exp && Date.now() / 1000 > exp) return null
  return claims
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = parseCookies(req.headers.cookie as string | undefined)[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ authenticated: false })
  }

  const key = signingKey()
  if (!key) {
    console.error('session: no JWT signing secret configured')
    return res.status(500).json({ error: 'Server auth not configured' })
  }

  const claims = verifyHs256(token, key)
  if (!claims) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
    return res.status(401).json({ authenticated: false })
  }

  const hasura = (claims[HASURA_CLAIMS] as Record<string, unknown>) || {}
  const user = {
    id: hasura['x-hasura-user-id'] ?? claims.sub ?? null,
    defaultRole: hasura['x-hasura-default-role'] ?? 'user',
    allowedRoles: hasura['x-hasura-allowed-roles'] ?? ['user'],
    email: (claims.email as string) ?? null,
    displayName: (claims.name as string) ?? (claims.email as string) ?? null,
  }
  return res.status(200).json({ authenticated: true, user })
}
