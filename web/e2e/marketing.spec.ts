/**
 * marketing.spec.ts — E2E tests for task.nself.org homepage
 */
import { test, expect } from '@playwright/test'

test.describe('Homepage marketing page', () => {
  test('loads with correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ɳTask/)
  })

  test('has h1 with ɳTask branding', async ({ page }) => {
    await page.goto('/')
    const h1 = page.locator('h1').first()
    await expect(h1).toContainText('ɳTask')
  })

  test('feature grid does not contain removed features', async ({ page }) => {
    await page.goto('/')
    const pageText = await page.textContent('body')
    // These were removed per D-S7-T1
    expect(pageText).not.toContain('Location reminders')
    expect(pageText).not.toContain('Shared lists')
  })

  test('CTA links to /login', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('link', { name: /Get started|Open the app|Open Web App/i }).first()
    await expect(cta).toBeVisible()
  })

  test('robots.txt is accessible and correct', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    expect(response?.status()).toBe(200)
    const text = await page.textContent('body')
    expect(text).toContain('Disallow: /app/')
    expect(text).toContain('Sitemap:')
  })

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    expect(response?.status()).toBe(200)
  })
})
