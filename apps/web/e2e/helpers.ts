import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'
export const password = 'playwright-test-password'
export type Credentials = { email: string; password: string }
export type Firm = { id: string; slug: string; owner: Credentials; ownerId: string; token: string; suffix: string }

export async function createFirm(request: APIRequestContext, prefix: string, email?: string): Promise<Firm> {
  const suffix = randomUUID().replaceAll('-', '')
  const owner = { email: email ?? `e2e-${prefix}-owner-${suffix}@forgeboard.test`, password }
  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E ${prefix} ${suffix.slice(0, 8)}`, firmSlug: `e2e-${prefix}-${suffix.slice(0, 12)}`,
      ownerEmail: owner.email, ownerName: 'Playwright Owner', password: owner.password },
  })
  expect(onboarding.status(), 'Spring must be running with a writable disposable database').toBe(201)
  const created = await onboarding.json() as { firmId: string; ownerId: string; firmSlug: string }
  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: owner })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string }
  return { id: created.firmId, slug: created.firmSlug, owner, ownerId: created.ownerId, token: credentials.accessToken, suffix }
}

export function headers(firm: Firm) { return { Authorization: `Bearer ${firm.token}`, 'X-ForgeBoard-Firm': firm.id } }

export async function signInAt(page: Page, path: string, credentials: Credentials) {
  await page.goto(path)
  await expect(page).toHaveURL(`/sign-in?callbackUrl=${encodeURIComponent(path)}`)
  await page.getByLabel('Email address').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(path, { timeout: 15_000 })
}
