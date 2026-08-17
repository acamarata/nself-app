import { defineConfig, devices } from '@playwright/test';

/**
 * nself-tasks Playwright configuration
 * T-0395
 *
 * Smoke tests run against the tasks app at TASKS_URL (default: localhost:3017).
 * The frontend dev server runs on port 3017 inside the tasks project.
 *
 * Usage:
 *   TASKS_URL=http://localhost:3017 pnpm test:e2e
 *   TASKS_URL=https://task.nself.org pnpm test:e2e
 */
export default defineConfig({
  // Resolved relative to THIS file, not the repo root. './tests/e2e' pointed at
  // tests/tests/e2e and matched nothing, which is one of several reasons this
  // suite never actually ran.
  testDir: './e2e',

  // Stop on first failure in CI to surface issues fast
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.TASKS_URL || 'http://localhost:3017',

    // Capture artifacts on failure
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
