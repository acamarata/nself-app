/**
 * offline.spec.ts — E2E test for offline mode behavior
 */
import { test, expect } from '@playwright/test'

test.describe('Offline mode', () => {
  test('OfflineBanner is visible when network is offline', async ({ page, context }) => {
    await page.goto('/login')

    // Set offline mode
    await context.setOffline(true)

    // Navigate to any app page — OfflineBanner should show
    // (Note: in offline mode, the app shell may not load fully)
    // This is a structural test — in full offline, the cached shell should load
    // Skip if service worker is not active (local dev without built SW)
    const hasSw = await page.evaluate(() =>
      'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
    )

    if (!hasSw) {
      test.skip()
      return
    }

    // With service worker active, navigate and check OfflineBanner
    await page.goto('/lists')
    await expect(page.getByRole('status', { name: /offline/i }).or(
      page.locator('[class*="offline"]')
    )).toBeVisible({ timeout: 5000 })
  })
})
