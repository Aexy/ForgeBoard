import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Spring password grants use BCrypt. Keep disposable integration fixtures
  // deterministic instead of competing for the same local backend resources.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next dev --port 3000',
    // Probe the dedicated sign-in compatibility route so Playwright can reuse
    // or start Next reliably without depending on an authenticated page.
    url: new URL('/sign-in', baseURL).toString(),
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'playwright-only-auth-secret-with-sufficient-length',
      AUTH_URL: baseURL,
      FORGEBOARD_API_BASE_URL: process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080',
      FORGEBOARD_TOKEN_ISSUER: process.env.FORGEBOARD_TOKEN_ISSUER ?? 'forgeboard',
      FORGEBOARD_PUBLIC_ORIGIN: baseURL,
      // Fixture firms are generated per test. Do not inherit a deployment
      // preview allow-list into the isolated local Next dev server.
    },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile-workflow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: /mobile-workflow\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
  ],
})
