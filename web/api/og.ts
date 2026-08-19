/**
 * api/og.ts — GET /api/og (Vercel Edge Function)
 *
 * Purpose:    Generate Open Graph images via @nself-web/og.
 * Inputs:     Query params (title, product, etc.)
 * Outputs:    PNG image buffer
 * Constraints: @vercel/og's ImageResponse only runs on the Edge runtime (its
 *              wasm imports use bundler-only `?module` syntax) — a Node.js
 *              serverless function returns 500. Must stay `runtime: 'edge'`.
 * SOT:        T-P3-E3 — web/ntask Vite migration
 */
import { buildOgResponse } from '@nself-web/og'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    return await buildOgResponse(req)
  } catch (error) {
    console.error('OG image error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
