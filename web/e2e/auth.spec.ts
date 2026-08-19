/**
 * auth.spec.ts — E2E tests for authentication flow
 */
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('unauthenticated /lists redirects to login', async ({ page }) => {
    await page.goto('/lists')
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login renders sign in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('/login has forgot password link', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
  })

  test('/reset-password is accessible without auth', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible()
  })

  test('/verify-email is accessible without auth', async ({ page }) => {
    await page.goto('/verify-email')
    await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible()
  })

  // Legacy /app/* bookmarks/emails must permanently redirect to the new root paths.
  test('legacy /app/lists redirects to /lists', async ({ page }) => {
    await page.goto('/app/lists')
    await expect(page).toHaveURL(/\/(login|lists)/)
  })

  // Skip actual login when test credentials not set
  test.skip(!process.env['NTASK_TEST_USER'], 'Test credentials not configured')
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[type="email"]', process.env['NTASK_TEST_USER'] ?? '')
    await page.fill('[type="password"]', process.env['NTASK_TEST_PASS'] ?? '')
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/\/lists|\/verify-email/)
  })
})
