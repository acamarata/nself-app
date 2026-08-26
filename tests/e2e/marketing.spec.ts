/**
 * marketing.spec.ts — the public marketing surface and the files crawlers read.
 *
 * Folded in from web/e2e/marketing.spec.ts on 2026-08-24 (WB-1); that suite was
 * never executed by any workflow.
 */
import { test, expect } from '@playwright/test'

test.describe('marketing page', () => {
  test('the home page is titled and branded ɳTask', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ɳTask/)
    // The h1 is the value proposition, not the product name — the brand lives in
    // the header. The folded-in version asserted the h1 contained "ɳTask" and
    // would have failed against production from the day the copy changed, which
    // nobody noticed because nothing ran it.
    //
    // Asserted on the ACCESSIBLE NAME, not just visible text. The header comes
    // from the shared @nself-web/ui package, whose brand link used to hardcode
    // aria-label="ɳSelf home" -- so a screen reader on task.nself.org announced
    // the wrong product while the visible text read correctly. The shared
    // component now takes a brandLabel prop (nself-org/packages#12) and
    // AppShell passes "ɳTask home".
    //
    // Checking visible text alone is what let that ship: it passed the whole
    // time the accessible name was wrong. This assertion fails if either half
    // regresses.
    await expect(page.getByText('ɳTask', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /ɳTask/ }).first()).toBeVisible()
  })

  test('the feature grid does not advertise features that were removed', async ({ page }) => {
    // D-S7-T1 removed these. A marketing page that re-grows a claim the product
    // does not have is the exact failure the 2026-08-24 review found in the docs.
    await page.goto('/')
    const pageText = (await page.textContent('body')) ?? ''
    expect(pageText).not.toContain('Location reminders')
    expect(pageText).not.toContain('Shared lists')
  })

  test('the primary call to action leads into the app', async ({ page }) => {
    await page.goto('/')
    // Live copy is "Sign up free" / "Log in"; the old spec looked for
    // "Get started|Open the app|Open Web App", none of which exist on the page.
    const cta = page.getByRole('link', { name: /sign up free|get started|log in/i }).first()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/(signup|login|register)/)
  })

  test('robots.txt keeps the app out of the index and points at the sitemap', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    expect(response?.status()).toBe(200)
    const text = (await page.textContent('body')) ?? ''
    expect(text).toContain('Disallow: /app/')
    expect(text).toContain('Sitemap:')
  })

  test('sitemap.xml is served', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    expect(response?.status()).toBe(200)
  })
})
