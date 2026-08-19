/**
 * og.spec.ts — E2E test for OG image generation
 * Only runs against Vercel preview/production (local Vite doesn't serve /api/)
 */
import { test, expect } from '@playwright/test'

test.skip(!process.env['PLAYWRIGHT_BASE_URL'], 'OG endpoint only available in deployed environment')

test('/api/og returns PNG image', async ({ request }) => {
  const response = await request.get('/api/og?title=Test')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/png')
})
