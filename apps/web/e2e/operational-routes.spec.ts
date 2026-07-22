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
  clientName: string
  workflowName: string
}

async function signInAt(page: Page, path: string, credentials: Credentials) {
  await page.goto(path)
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Ffirms%2F/)
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
  const clientName = `E2E Engagement Client ${suffix.slice(0, 8)}`
  const workflowName = `E2E Engagement Workflow ${suffix.slice(0, 8)}`

  const client = await request.post(`${apiBaseURL}/api/clients`, {
    headers,
    data: { legalName: clientName, displayName: clientName, primaryEmail: null },
  })
  expect(client.status()).toBe(201)

  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: workflowName, stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(workflow.status()).toBe(201)

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

  return { firmSlug, owner, manager, readOnly, clientName, workflowName }
}

test('opens operational routes directly for their authorized roles', async ({ page, browser, request }) => {
  const firm = await createOperationalFirm(request)

  await signInAt(page, `/firms/${firm.firmSlug}/engagements`, firm.owner)
  await expect(page.getByRole('heading', { name: 'Engagements', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ New template' })).toBeVisible()

  await page.goto(`/firms/${firm.firmSlug}/employees`)
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible()
  await expect(page.locator('summary').filter({ hasText: 'New employee' })).toBeVisible()

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
  await expect(page.locator('summary').filter({ hasText: 'New employee' })).toHaveCount(0)

  await page.goto(`/firms/${firm.firmSlug}/audit-trail`)
  await expect(page.locator('main [role="alert"]')).toContainText('Only firm owners and managers can view the activity trail.')
  await context.close()
})

test('provisions a read-only employee through the browser and preserves their restricted access', async ({ page, browser, request }) => {
  const firm = await createOperationalFirm(request)
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const employee = {
    email: `e2e-browser-readonly-${suffix}@forgeboard.test`,
    password,
    displayName: `E2E Browser Read only ${suffix.slice(-6)}`,
  }

  await signInAt(page, `/firms/${firm.firmSlug}/employees`, firm.owner)
  await page.locator('summary').filter({ hasText: 'New employee' }).click()
  await page.getByLabel('Employee name').fill(employee.displayName)
  await page.getByLabel('Work email').fill(employee.email)
  await page.getByLabel('Temporary password').fill(employee.password)
  await page.getByLabel('Role').selectOption('READ_ONLY')
  await page.getByRole('button', { name: 'Create employee' }).click()
  await expect(page.getByRole('heading', { name: employee.displayName })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: employee.displayName })).toBeVisible()
  await expect(page.getByText(employee.email, { exact: true })).toBeVisible()

  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()
  await signInAt(employeePage, `/firms/${firm.firmSlug}/engagements`, employee)
  await expect(employeePage.getByRole('heading', { name: 'Engagements', exact: true })).toBeVisible()
  await expect(employeePage.getByRole('button', { name: '+ New template' })).toHaveCount(0)
  await expect(employeePage.getByRole('button', { name: '+ Start engagement' })).toHaveCount(0)
  await expect(employeePage.getByRole('button', { name: '+ Request' })).toHaveCount(0)

  await employeePage.goto(`/firms/${firm.firmSlug}/employees`)
  await expect(employeePage.locator('main [role="alert"]')).toContainText('Only owners and administrators can manage employee access.')
  await employeeContext.close()
})

test('runs an owner engagement and document-request operating loop through the browser', async ({ page, browser, request }) => {
  const firm = await createOperationalFirm(request)
  const templateName = `Monthly close ${firm.firmSlug.slice(-6)}`
  const requestLabel = `Bank statements ${firm.firmSlug.slice(-6)}`

  await signInAt(page, `/firms/${firm.firmSlug}/engagements`, firm.owner)

  await page.getByRole('button', { name: '+ New template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByLabel('Workflow').selectOption({ label: firm.workflowName })
  await page.getByLabel('Default work item').fill(`Prepare ${templateName}`)
  await page.getByLabel('Due day').fill('20')
  await page.getByRole('button', { name: 'Save template' }).click()
  await expect(page.getByRole('button', { name: '+ Start engagement' })).toBeEnabled()

  await page.getByRole('button', { name: '+ Start engagement' }).click()
  await page.getByLabel('Template').selectOption({ label: templateName })
  await page.getByLabel('Client').selectOption({ label: firm.clientName })
  await page.getByLabel('Period start').fill('2026-07-01')
  await page.getByRole('button', { name: 'Start engagement' }).click()
  await expect(page.locator('article').filter({ hasText: templateName })).toContainText('Board work item created')

  await page.getByRole('button', { name: '+ Request' }).click()
  await page.getByLabel('Client').selectOption({ label: firm.clientName })
  await page.getByLabel('Request').fill(requestLabel)
  await page.getByRole('button', { name: 'Send request' }).click()
  const documentRequest = page.locator('article').filter({ hasText: requestLabel })
  await expect(documentRequest).toContainText('requested')
  await documentRequest.getByRole('button', { name: 'Mark received' }).click()
  await expect(documentRequest).toContainText('received')

  await page.reload()
  await expect(page.locator('article').filter({ hasText: templateName })).toContainText('Board work item created')
  await expect(page.locator('article').filter({ hasText: requestLabel })).toContainText('received')

  const managerContext = await browser.newContext()
  const managerPage = await managerContext.newPage()
  const auditPath = `/firms/${firm.firmSlug}/audit-trail?action=document-request.received`
  await signInAt(managerPage, auditPath, firm.manager)
  await expect(managerPage.getByLabel('Action')).toHaveValue('document-request.received')
  const receivedActivity = managerPage.getByRole('listitem').filter({ hasText: 'Document-Request Received' })
  await expect(receivedActivity).toContainText('ForgeBoard activity')

  await managerPage.reload()
  await expect(managerPage).toHaveURL(auditPath)
  await expect(managerPage.getByRole('listitem').filter({ hasText: 'Document-Request Received' })).toContainText('ForgeBoard activity')
  await managerContext.close()
})
