/**
 * public-surface.spec.ts — contracts the deployed ɳTask web surface must hold.
 *
 * These run against a real deployment (TASKS_URL, default task.nself.org) and
 * are strictly read-only: no account is created, no password is changed, no
 * email is sent.
 *
 * The suite they replace asserted things like `body` being visible and status
 * codes being under 500, which stayed green while password reset was entirely
 * non-functional. Every assertion here is one a human would notice breaking.
 */
import { test, expect } from '@playwright/test'

test.describe('app shell', () => {
  test('home page returns 200 and renders the app root', async ({ page }) => {
    const resp = await page.goto('/')
    expect(resp?.status()).toBe(200)
    await expect(page.locator('#root')).toBeAttached()
  })

  test('an unknown path still serves the SPA rather than a hosting 404', async ({ page }) => {
    // The SPA rewrite must not swallow real asset paths but must catch app routes.
    const resp = await page.goto('/definitely-not-a-real-route')
    expect(resp?.status()).toBe(200)
    await expect(page.locator('#root')).toBeAttached()
  })
})

test.describe('password reset', () => {
  test('the reset request page renders a form', async ({ page }) => {
    const resp = await page.goto('/reset-password')
    expect(resp?.status()).toBe(200)
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('the confirm page rejects a link with no token instead of showing a usable form', async ({
    page,
  }) => {
    await page.goto('/reset-confirm')
    // Regression guard: the password field must not be usable without a token.
    await expect(page.locator('input[type="password"]').first()).toBeDisabled({ timeout: 10_000 })
  })

  test('a reset link landing on the root is routed to the confirm page', async ({ page }) => {
    // hasura-auth always redirects to the bare origin with the token in the query.
    // For a long time nothing handled that, so the user landed on the marketing
    // page and the reset silently went nowhere. Pin the routing.
    await page.goto('/?refreshToken=00000000-0000-0000-0000-000000000000&type=passwordReset')
    await expect(page).toHaveURL(/\/reset-confirm/, { timeout: 10_000 })
  })
})

test.describe('deep link association files', () => {
  test('apple-app-site-association serves JSON with a real team id', async ({ request }) => {
    const resp = await request.get('/.well-known/apple-app-site-association')
    expect(resp.status()).toBe(200)
    // Apple requires JSON content-type and refuses the file otherwise.
    expect(resp.headers()['content-type']).toContain('json')

    const body = (await resp.json()) as {
      applinks: { details: { appID: string; paths: string[] }[] }
    }
    const detail = body.applinks.details[0]
    expect(detail).toBeDefined()
    // An unsubstituted placeholder shipped here once and broke deep links silently.
    expect(detail!.appID).not.toContain('APPLE_TEAM_ID')
    expect(detail!.appID).toMatch(/^[A-Z0-9]{10}\./)
    expect(detail!.paths).toContain('/shared/*')
  })

  test('assetlinks.json is valid JSON for Android', async ({ request }) => {
    const resp = await request.get('/.well-known/assetlinks.json')
    expect(resp.status()).toBe(200)
    const body = (await resp.json()) as unknown[]
    expect(Array.isArray(body)).toBe(true)
  })
})

test.describe('legal pages', () => {
  for (const path of ['/legal/privacy', '/legal/terms']) {
    test(`${path} renders substantive content`, async ({ page }) => {
      const resp = await page.goto(path)
      expect(resp?.status()).toBe(200)
      // Guards against a route that resolves but renders an empty shell.
      const text = await page.locator('body').innerText()
      expect(text.length).toBeGreaterThan(500)
    })
  }
})
