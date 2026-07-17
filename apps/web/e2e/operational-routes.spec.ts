import { randomUUID } from 'node:crypto'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'
const password = 'playwright-test-password'

type Credentials = { email: string; password: string }

type OperationalFirm = {
  firmSlug: string
  owner: Credentials
  manager: Credentials
  readOnly: Credentials
}

async function signInAt(page: Page, path: string, credentials: Credentials) {
  await page.goto(path)
  await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/)
  await page.getByLabel('Email address').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(path, { timeout: 15_000 })
}

async function createOperationalFirm(request: APIRequestContext): Promise<OperationalFirm> {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-operations-${suffix.slice(0, 12)}`
  const owner = { email: `e2e-owner-${suffix}@forgeboard.test`, password }
  const manager = { email: `e2e-manager-${suffix}@forgeboard.test`, password }
  const readOnly = { email: `e2e-readonly-${suffix}@forgeboard.test`, password }

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E Operations ${suffix.slice(0, 8)}`, firmSlug, ownerEmail: owner.email, ownerName: 'Playwright Owner', password },
  })
  expect(onboarding.status(), 'Spring must be running with a writable disposable database').toBe(201)

  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: owner })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string; firms: Array<{ id: string }> }
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'X-ForgeBoard-Firm': credentials.firms[0].id }

  for (const employee of [
    { ...manager, displayName: 'Playwright Manager', role: 'MANAGER' },
    { ...readOnly, displayName: 'Playwright Read only', role: 'READ_ONLY' },
  ]) {
    const provision = await request.post(`${apiBaseURL}/api/identity/employees`, {
      headers,
      data: { displayName: employee.displayName, email: employee.email, temporaryPassword: employee.password, role: employee.role },
    })
    expect(provision.status()).toBe(201)
  }

  return { firmSlug, owner, manager, readOnly }
}

test('opens operational routes directly for their authorized roles', async ({ page, browser, request }) => {
  const firm = await createOperationalFirm(request)

  await signInAt(page, `/firms/${firm.firmSlug}/engagements`, firm.owner)
  await expect(page.getByRole('heading', { name: 'Engagements', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ New template' })).toBeVisible()

  await page.goto(`/firms/${firm.firmSlug}/employees`)
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ New employee' })).toBeVisible()

  const managerContext = await browser.newContext()
  const managerPage = await managerContext.newPage()
  await signInAt(managerPage, `/firms/${firm.firmSlug}/audit-trail`, firm.manager)
  await expect(managerPage.getByRole('heading', { name: 'Activity trail' })).toBeVisible()
  await expect(managerPage.getByRole('link', { name: 'Employees' })).toHaveCount(0)
  await managerContext.close()
})

test('does not expose operational writes or restricted routes to read-only staff', async ({ browser, request }) => {
  const firm = await createOperationalFirm(request)
  const context = await browser.newContext()
  const page = await context.newPage()

  await signInAt(page, `/firms/${firm.firmSlug}/engagements`, firm.readOnly)
  await expect(page.getByRole('heading', { name: 'Engagements', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ New template' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Start engagement' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ Request' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Employees' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Activity trail' })).toHaveCount(0)

  await page.goto(`/firms/${firm.firmSlug}/employees`)
  await expect(page.locator('main [role="alert"]')).toContainText('Only owners and administrators can manage employee access.')
  await expect(page.getByRole('button', { name: '+ New employee' })).toHaveCount(0)

  await page.goto(`/firms/${firm.firmSlug}/audit-trail`)
  await expect(page.locator('main [role="alert"]')).toContainText('Only firm owners and managers can view the activity trail.')
  await context.close()
})
