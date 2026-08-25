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
  preparer: Credentials
  reviewer: Credentials
  clientName: string
  workflowName: string
  workflowId: string
  workflowSlug: string
  firmId: string
  ownerToken: string
  preparerUserId: string
  reviewerUserId: string
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
  const preparer = { email: `e2e-preparer-${suffix}@forgeboard.test`, password }
  const reviewer = { email: `e2e-reviewer-${suffix}@forgeboard.test`, password }

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
    data: {
      name: workflowName,
      stages: [
        { name: 'Prepare', attention: 'NONE', finalStage: false },
        { name: 'Blocked', attention: 'BLOCKED', finalStage: false },
        { name: 'Review', attention: 'AWAITING_REVIEW', finalStage: false },
        { name: 'Complete', attention: 'NONE', finalStage: true },
      ],
    },
  })
  expect(workflow.status()).toBe(201)
  const createdWorkflow = await workflow.json() as { id: string; workflowSlug: string }

  const employees = await Promise.all([
    { ...manager, displayName: 'Playwright Manager', role: 'MANAGER' },
    { ...readOnly, displayName: 'Playwright Read only', role: 'READ_ONLY' },
    { ...preparer, displayName: 'Playwright Preparer', role: 'MEMBER' },
    { ...reviewer, displayName: 'Playwright Reviewer', role: 'MEMBER' },
  ].map((employee) => provisionEmployeeThroughInvitation(request, headers, employee)))

  return {
    firmSlug, owner, manager, readOnly, preparer, reviewer, clientName, workflowName,
    workflowId: createdWorkflow.id, workflowSlug: createdWorkflow.workflowSlug, firmId: credentials.firms[0].id,
    ownerToken: credentials.accessToken,
    preparerUserId: employees[2].userId, reviewerUserId: employees[3].userId,
  }
}

async function provisionEmployeeThroughInvitation(request: APIRequestContext, headers: Record<string, string>,
  employee: Credentials & { displayName: string; role: string }): Promise<{ userId: string }> {
  const invitation = await request.post(`${apiBaseURL}/api/identity/employees`, {
    headers,
    data: { displayName: employee.displayName, email: employee.email, role: employee.role },
  })
  expect(invitation.status()).toBe(201)
  const link = await invitation.json() as { link: string }
  const token = new URL(link.link).pathname.split('/').at(-1)
  expect(token).toBeTruthy()
  const acceptance = await request.post(`${apiBaseURL}/api/access/invitations/${token}/accept-new`, {
    data: { displayName: employee.displayName, password: employee.password },
  })
  expect(acceptance.status()).toBe(204)
  const response = await request.get(`${apiBaseURL}/api/identity/employees`, { headers })
  expect(response.status()).toBe(200)
  const provisioned = (await response.json() as Array<{ userId: string | null; email: string }>)
    .find((candidate) => candidate.email === employee.email)
  expect(provisioned?.userId).toBeTruthy()
  return { userId: provisioned!.userId! }
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
  await page.locator('details form').getByLabel('Role').selectOption('READ_ONLY')
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByRole('heading', { name: employee.displayName })).toBeVisible()
  const invitationLink = await page.getByLabel('Invitation link').inputValue()

  await page.reload()
  await expect(page.getByRole('heading', { name: employee.displayName })).toBeVisible()
  await expect(page.getByText(employee.email, { exact: true })).toBeVisible()

  const employeeContext = await browser.newContext()
  const employeePage = await employeeContext.newPage()
  await employeePage.goto(new URL(invitationLink).pathname)
  await employeePage.getByLabel('Your name').fill(employee.displayName)
  await employeePage.getByLabel('Password', { exact: true }).fill(employee.password)
  await employeePage.getByLabel('Confirm password').fill(employee.password)
  await employeePage.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(employeePage).toHaveURL('/', { timeout: 15_000 })
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

test('runs the engagement review lifecycle through the browser without moving the completed card', async ({ page, browser, request }) => {
  const firm = await createOperationalFirm(request)
  const headers = { Authorization: `Bearer ${firm.ownerToken}`, 'X-ForgeBoard-Firm': firm.firmId }
  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: {
      name: `Lifecycle workflow ${firm.firmSlug.slice(-6)}`,
      stages: [
        { name: 'Prepare', attention: 'NONE', finalStage: false },
        { name: 'Review', attention: 'AWAITING_REVIEW', finalStage: false },
        { name: 'Complete', attention: 'NONE', finalStage: true },
      ],
    },
  })
  expect(workflow.status()).toBe(201)
  const lifecycleWorkflow = await workflow.json() as { id: string; workflowSlug: string }
  const template = await request.post(`${apiBaseURL}/api/engagements/templates`, {
    headers,
    data: { name: `Lifecycle ${firm.firmSlug.slice(-6)}`, workflowId: lifecycleWorkflow.id, recurrence: 'MONTHLY', defaultWorkItemTitle: 'Prepare lifecycle', dueDay: 20 },
  })
  expect(template.status()).toBe(201)
  const createdTemplate = await template.json() as { id: string }
  const clients = await request.get(`${apiBaseURL}/api/clients`, { headers })
  expect(clients.status()).toBe(200)
  const client = (await clients.json() as Array<{ id: string }>)[0]
  const engagementResponse = await request.post(`${apiBaseURL}/api/engagements/templates/${createdTemplate.id}/instances`, {
    headers,
    data: { clientId: client.id, periodStart: '2026-07-01' },
  })
  expect(engagementResponse.status()).toBe(201)
  const engagement = await engagementResponse.json() as { id: string; workItemId: string }
  await exerciseLifecycleBrowserFlow(page, browser, request, { ...firm, workflowId: lifecycleWorkflow.id, workflowSlug: lifecycleWorkflow.workflowSlug }, headers, engagement)
})

async function exerciseLifecycleBrowserFlow(page: Page, browser: import('@playwright/test').Browser, request: APIRequestContext, firm: OperationalFirm, headers: Record<string, string>, engagement: { id: string; workItemId: string }) {
  const initialBoard = await request.get(`${apiBaseURL}/api/workflows/public/${firm.workflowSlug}`, { headers })
  expect(initialBoard.status()).toBe(200)
  const board = await initialBoard.json() as { stages: Array<{ id: string; name: string; items: Array<{ id: string; stageId: string }> }> }
  const prepare = board.stages.find((stage) => stage.name === 'Prepare')!
  const workItem = prepare.items.find((item) => item.id === engagement.workItemId)!
  for (const [path, body] of [
    [`owner`, { ownerUserId: firm.preparerUserId }],
    [`reviewer`, { userId: firm.reviewerUserId }],
  ] as const) {
    const response = await request.put(`${apiBaseURL}/api/workflows/${firm.workflowId}/items/${workItem.id}/${path}`, { headers, data: body })
    expect(response.status()).toBe(200)
  }

  const preparerContext = await browser.newContext(); const preparerPage = await preparerContext.newPage()
  await signInAt(preparerPage, `/firms/${firm.firmSlug}/workflow/${firm.workflowSlug}`, firm.preparer)
  await preparerPage.getByRole('button', { name: /Move right Prepare lifecycle/ }).click()
  await expect(preparerPage.getByRole('heading', { name: 'Review', exact: true })).toBeVisible()

  const reviewerContext = await browser.newContext(); const reviewerPage = await reviewerContext.newPage()
  await signInAt(reviewerPage, `/firms/${firm.firmSlug}/workflow/${firm.workflowSlug}`, firm.reviewer)
  await expect(reviewerPage.getByLabel('Review stage').getByRole('heading', { name: 'Prepare lifecycle' })).toBeVisible()
  await reviewerPage.getByRole('button', { name: /Move left Prepare lifecycle/ }).click()
  await reviewerPage.getByLabel('Review note').fill('Please correct the reconciliation.')
  await reviewerPage.getByRole('button', { name: 'Return work' }).click()
  await expect(reviewerPage.getByRole('heading', { name: 'Prepare', exact: true })).toBeVisible()

  await preparerPage.reload()
  await preparerPage.getByRole('button', { name: /Move right Prepare lifecycle/ }).click()
  await reviewerPage.reload()
  await reviewerPage.getByRole('button', { name: /Move right Prepare lifecycle/ }).click()
  await expect.poll(async () => {
    const completed = await request.get(`${apiBaseURL}/api/engagements/${engagement.id}`, { headers })
    expect(completed.status()).toBe(200)
    return (await completed.json() as { engagement: { status: string } }).engagement.status
  }).toBe('COMPLETE')
  const completedDetail = await request.get(`${apiBaseURL}/api/engagements/${engagement.id}`, { headers })
  expect((await completedDetail.json() as { history: { reviewDecisions: Array<{ decision: string; note: string | null }> } }).history.reviewDecisions)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ decision: 'RETURNED', note: 'Please correct the reconciliation.' }),
      expect.objectContaining({ decision: 'APPROVED', note: null }),
    ]))

  const managerContext = await browser.newContext(); const managerPage = await managerContext.newPage()
  await signInAt(managerPage, `/firms/${firm.firmSlug}/engagements`, firm.manager)
  managerPage.once('dialog', (dialog) => dialog.accept())
  await managerPage.getByRole('button', { name: 'Reopen engagement' }).click()
  await expect(managerPage.getByRole('button', { name: 'Cancel engagement' })).toBeVisible()
  managerPage.once('dialog', (dialog) => dialog.accept())
  await managerPage.getByRole('button', { name: 'Cancel engagement' }).click()
  await expect(managerPage.getByRole('button', { name: 'Archive engagement' })).toBeVisible()
  managerPage.once('dialog', (dialog) => dialog.accept())
  await managerPage.getByRole('button', { name: 'Archive engagement' }).click()
  await expect(managerPage.getByRole('button', { name: 'Unarchive engagement' })).toBeVisible()
  managerPage.once('dialog', (dialog) => dialog.accept())
  await managerPage.getByRole('button', { name: 'Unarchive engagement' }).click()
  await expect(managerPage.getByText('cancelled', { exact: true })).toBeVisible()

  const finalBoard = await request.get(`${apiBaseURL}/api/workflows/public/${firm.workflowSlug}`, { headers })
  const finalStages = (await finalBoard.json() as { stages: Array<{ name: string; items: Array<{ id: string }> }> }).stages
  expect(finalStages.find((stage) => stage.name === 'Complete')!.items.map((item) => item.id)).toContain(workItem.id)
  await Promise.all([preparerContext.close(), reviewerContext.close(), managerContext.close()])
}
