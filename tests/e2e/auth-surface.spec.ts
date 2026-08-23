/**
 * auth-surface.spec.ts — the unauthenticated entry points a real user hits.
 *
 * Folded in from web/e2e/auth.spec.ts on 2026-08-24. That suite lived beside a
 * second Playwright config in web/ and no workflow ever executed it: five spec
 * files, zero runs (WB-1). Two half-owned suites is how that happens, so there
 * is now exactly one config (tests/playwright.config.ts) and one directory.
 *
 * Read-only, like the rest of this suite: no account is created, no password is
 * changed, no email is sent. The credentialed login test that came with the old
 * file is deliberately NOT folded in — it was permanently skipped for want of
 * NTASK_TEST_USER, and signing in against production is not a read-only act.
 */
import { test, expect } from '@playwright/test'

test.describe('authentication entry points', () => {
  test('an unauthenticated /lists redirects to login', async ({ page }) => {
    await page.goto('/lists')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login renders a sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('/login offers a forgot-password route', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
  })

  test('/verify-email is reachable without a session', async ({ page }) => {
    await page.goto('/verify-email')
    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible()
  })

  // Bookmarks and old emails point at /app/*. Those must keep working.
  test('a legacy /app/lists link still lands somewhere valid', async ({ page }) => {
    await page.goto('/app/lists')
    await expect(page).toHaveURL(/\/(login|lists)/)
  })
})
