/**
 * headers-and-og.spec.ts — response-level contracts: the security headers the
 * app is served with, and the OG image endpoint.
 *
 * Folded in from web/e2e/{csp,og}.spec.ts on 2026-08-24 (WB-1), with their
 * self-skips removed. Both used to opt out unless a variable was set — csp.spec
 * skipped whenever the header was absent, which is precisely the case it exists
 * to catch. This suite always runs against a deployment (TASKS_URL, default
 * task.nself.org), so there is nothing to skip around.
 */
import { test, expect } from '@playwright/test'

test('the app is served with a Content-Security-Policy', async ({ page }) => {
  const response = await page.goto('/')
  const csp = response?.headers()['content-security-policy']
  expect(csp, 'no Content-Security-Policy header on the deployed app').toBeTruthy()
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain('connect-src')
})

test('the app is served with HSTS', async ({ page }) => {
  const response = await page.goto('/')
  const hsts = response?.headers()['strict-transport-security']
  expect(hsts, 'no Strict-Transport-Security header on the deployed app').toBeTruthy()
  expect(hsts).toMatch(/max-age=\d+/)
})

test('/api/og renders a PNG', async ({ request }) => {
  const response = await request.get('/api/og?title=Test')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/png')
})
