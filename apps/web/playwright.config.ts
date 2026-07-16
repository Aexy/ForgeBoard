import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next dev --port 3000',
    // The App Router intentionally has no public root route. Probe the
    // available sign-in route so Playwright can reuse or start Next reliably.
    url: new URL('/sign-in', baseURL).toString(),
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'playwright-only-auth-secret-with-sufficient-length',
      AUTH_URL: baseURL,
      FORGEBOARD_API_BASE_URL: process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080',
      FORGEBOARD_TOKEN_ISSUER: process.env.FORGEBOARD_TOKEN_ISSUER ?? 'forgeboard',
      FORGEBOARD_PUBLIC_ORIGIN: baseURL,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
