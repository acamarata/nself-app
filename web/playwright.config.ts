/**
 * playwright.config.ts — E2E test config for task.nself.org
 *
 * Purpose:    Playwright E2E test runner config: dev server, browsers, test dir.
 * Inputs:     PLAYWRIGHT_BASE_URL env (for running against deployed URL)
 * Constraints: Default against local dev server; CI uses Vercel preview URL
 * SPORT:      D-S10-T3
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3017'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: process.env['PLAYWRIGHT_BASE_URL']
    ? undefined
    : {
        command: 'pnpm dev',
        port: 3017,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
