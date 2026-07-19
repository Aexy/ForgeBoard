import { randomUUID } from 'node:crypto'

import { expect, test, type APIRequestContext } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'

type WorkflowBoardResponse = {
  workflowSlug: string
  stages: Array<{ id: string; items: Array<{ id: string; taskReference: string; title: string }> }>
}

async function canonicalWorkflowBoard(request: APIRequestContext, headers: Record<string, string>, workflowId: string): Promise<WorkflowBoardResponse> {
  const response = await request.get(`${apiBaseURL}/api/workflows/${workflowId}`, { headers })
  expect(response.status()).toBe(200)
  return response.json() as Promise<WorkflowBoardResponse>
}

test('uses shareable workflow routes, task workspace, moves, and saved views', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-workflow-${suffix.slice(0, 12)}`
  const email = `e2e-workflow-${suffix}@forgeboard.test`
  const password = 'playwright-test-password'
  const urgentTitle = `Urgent close ${suffix.slice(0, 8)}`

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E Workflow ${suffix.slice(0, 8)}`, firmSlug, ownerEmail: email, ownerName: 'Playwright Owner', password },
  })
  expect(onboarding.status()).toBe(201)

  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: { email, password } })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string; firms: Array<{ id: string }> }
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'X-ForgeBoard-Firm': credentials.firms[0].id }

  const client = await request.post(`${apiBaseURL}/api/clients`, {
    headers,
    data: { legalName: `E2E Client ${suffix.slice(0, 8)}`, displayName: `E2E Client ${suffix.slice(0, 8)}`, primaryEmail: null },
  })
  expect(client.status()).toBe(201)
  const clientData = await client.json() as { id: string }
  const documentRequest = await request.post(`${apiBaseURL}/api/document-requests`, {
    headers,
    data: { clientId: clientData.id, label: `Bank statement ${suffix.slice(0, 8)}`, externalReference: null, dueDate: null },
  })
  expect(documentRequest.status()).toBe(201)
  const documentRequestData = await documentRequest.json() as { id: string; label: string }

  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: 'Monthly close', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(workflow.status()).toBe(201)
  const workflowData = await workflow.json() as { id: string; stages: Array<{ id: string }> }

  const boardData = await canonicalWorkflowBoard(request, headers, workflowData.id)

  const savedView = await request.post(`${apiBaseURL}/api/workflows/views`, {
    headers,
    data: { name: 'Urgent work', clientId: null, ownerUserId: null, dueState: null, priority: 'URGENT', unassigned: false },
  })
  expect(savedView.status()).toBe(201)

  const boardPath = `/firms/${firmSlug}/workflow/${boardData.workflowSlug}`
  await page.goto(`${boardPath}?priority=URGENT`)
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Ffirms%2F/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT`, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Add work item to Prepare' }).click()
  const newWorkItem = page.getByRole('form', { name: 'New work item' })
  await newWorkItem.locator('select[name="clientId"]').selectOption(clientData.id)
  await newWorkItem.getByLabel('Title').fill(urgentTitle)
  await newWorkItem.locator('select[name="priority"]').selectOption('URGENT')
  await newWorkItem.getByRole('button', { name: 'Create work item' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Work item created.' })).toHaveText('Work item created.')
  await page.reload()
  await expect(page.getByRole('button', { name: `Open ${urgentTitle} details` })).toBeVisible()
  const createdBoard = await canonicalWorkflowBoard(request, headers, workflowData.id)
  const createdItem = createdBoard.stages.flatMap((stage) => stage.items).find((candidate) => candidate.title === urgentTitle)
  expect(createdItem).toBeDefined()

  await page.goto(`/firms/${firmSlug}/workflow/${workflowData.id}?priority=URGENT&task=${createdItem!.id}`)
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT&task=${createdItem!.taskReference}`)
  await expect(page.getByRole('complementary', { name: `${urgentTitle} details` })).toBeVisible()
  await page.goto(`${boardPath}?priority=URGENT`)

  const cardTitle = page.getByRole('button', { name: `Open ${urgentTitle} details` })
  await expect(cardTitle).toBeVisible()
  await cardTitle.click()
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT&task=${createdItem!.taskReference}`)
  await page.getByRole('button', { name: 'Open task workspace' }).click()
  await expect(page).toHaveURL(`${boardPath}/tasks/${createdItem!.taskReference}`)
  await expect(page.getByRole('heading', { name: urgentTitle })).toBeVisible()
  await page.getByRole('button', { name: `Link ${documentRequestData.label}` }).click()
  await expect(page.getByRole('button', { name: `Unlink ${documentRequestData.label}` })).toBeVisible()
  await page.getByRole('button', { name: `Unlink ${documentRequestData.label}` }).click()
  await expect(page.getByRole('button', { name: `Link ${documentRequestData.label}` })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT&task=${createdItem!.taskReference}`)
  await expect(page.getByRole('complementary', { name: `${urgentTitle} details` })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT`)

  const card = page.getByLabel('Prepare stage').locator('article').filter({ hasText: urgentTitle })
  await card.dragTo(page.getByLabel('Review stage'))
  await expect(page.getByRole('alert').filter({ hasText: `${urgentTitle} moved.` })).toHaveText(`${urgentTitle} moved.`)
  await expect(page.getByLabel('Review stage').getByRole('heading', { name: urgentTitle })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Review stage').getByRole('heading', { name: urgentTitle })).toBeVisible()

  await page.locator('summary').click()
  await page.getByLabel('Apply saved workflow view').selectOption({ label: 'Urgent work' })
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT`)
})

test('refreshes a stale board after a confirmed Spring conflict', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-conflict-${suffix.slice(0, 12)}`
  const email = `e2e-conflict-${suffix}@forgeboard.test`
  const password = 'playwright-test-password'
  const title = `Concurrent close ${suffix.slice(0, 8)}`

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E Conflict ${suffix.slice(0, 8)}`, firmSlug, ownerEmail: email, ownerName: 'Playwright Owner', password },
  })
  expect(onboarding.status()).toBe(201)

  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: { email, password } })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string; firms: Array<{ id: string }> }
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'X-ForgeBoard-Firm': credentials.firms[0].id }

  const client = await request.post(`${apiBaseURL}/api/clients`, {
    headers,
    data: { legalName: title, displayName: title, primaryEmail: null },
  })
  expect(client.status()).toBe(201)
  const clientData = await client.json() as { id: string }
  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: 'Conflict workflow', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(workflow.status()).toBe(201)
  const workflowData = await workflow.json() as { id: string; stages: Array<{ id: string }> }
  const item = await request.post(`${apiBaseURL}/api/workflows/${workflowData.id}/items`, {
    headers,
    data: { clientId: clientData.id, stageId: workflowData.stages[0].id, title, description: '', dueDate: null, priority: 'NORMAL' },
  })
  expect(item.status()).toBe(201)
  const itemData = await item.json() as { id: string }
  const boardData = await canonicalWorkflowBoard(request, headers, workflowData.id)
  const createdItem = boardData.stages.flatMap((stage) => stage.items).find((candidate) => candidate.id === itemData.id)
  expect(createdItem).toBeDefined()

  const boardPath = `/firms/${firmSlug}/workflow/${boardData.workflowSlug}`
  await page.goto(boardPath)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  const card = page.getByLabel('Prepare stage').locator('article').filter({ hasText: title })
  await expect(card.getByRole('button', { name: `Open ${title} details` })).toBeVisible({ timeout: 15_000 })

  const concurrentMove = await request.patch(`${apiBaseURL}/api/workflows/${workflowData.id}/items/${itemData.id}/position`, {
    headers,
    data: { targetStageId: workflowData.stages[1].id, beforeItemId: null, afterItemId: null, expectedVersion: 0 },
  })
  expect(concurrentMove.status()).toBe(200)

  await card.getByRole('button', { name: `Move ${title} right` }).click()
  await expect(page.locator('p[role="alert"]:not(#__next-route-announcer__)')).toHaveText('This work item was changed by another user. The board was refreshed; retry your move.')
  await expect(page.getByLabel('Review stage').locator('article').filter({ hasText: title })).toBeVisible()
})

test('does not expose another firm workflow through the browser BFF', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const first = { slug: `e2e-first-${suffix.slice(0, 10)}`, email: `e2e-first-${suffix}@forgeboard.test` }
  const second = { slug: `e2e-second-${suffix.slice(0, 10)}`, email: `e2e-second-${suffix}@forgeboard.test` }
  const password = 'playwright-test-password'

  for (const firm of [first, second]) {
    const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
      data: { firmName: `E2E ${firm.slug}`, firmSlug: firm.slug, ownerEmail: firm.email, ownerName: 'Playwright Owner', password },
    })
    expect(onboarding.status()).toBe(201)
  }

  const secondGrant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: { email: second.email, password } })
  expect(secondGrant.status()).toBe(200)
  const secondCredentials = await secondGrant.json() as { accessToken: string; firms: Array<{ id: string }> }
  const secondHeaders = { Authorization: `Bearer ${secondCredentials.accessToken}`, 'X-ForgeBoard-Firm': secondCredentials.firms[0].id }
  const secondWorkflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers: secondHeaders,
    data: { name: 'Private second-firm workflow', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(secondWorkflow.status()).toBe(201)
  const secondWorkflowData = await secondWorkflow.json() as { id: string; stages: Array<{ id: string }> }
  const secondClient = await request.post(`${apiBaseURL}/api/clients`, {
    headers: secondHeaders,
    data: { legalName: 'Private second-firm client', displayName: 'Private second-firm client', primaryEmail: null },
  })
  expect(secondClient.status()).toBe(201)
  const secondClientData = await secondClient.json() as { id: string }
  const secondDocumentRequest = await request.post(`${apiBaseURL}/api/document-requests`, {
    headers: secondHeaders,
    data: { clientId: secondClientData.id, label: 'Private second-firm document', externalReference: null, dueDate: null },
  })
  expect(secondDocumentRequest.status()).toBe(201)
  const secondDocumentRequestData = await secondDocumentRequest.json() as { id: string }
  const secondItem = await request.post(`${apiBaseURL}/api/workflows/${secondWorkflowData.id}/items`, {
    headers: secondHeaders,
    data: { clientId: secondClientData.id, stageId: secondWorkflowData.stages[0].id, title: 'Private second-firm task', description: '', dueDate: null, priority: 'NORMAL' },
  })
  expect(secondItem.status()).toBe(201)
  const secondItemData = await secondItem.json() as { id: string }
  const secondBoard = await canonicalWorkflowBoard(request, secondHeaders, secondWorkflowData.id)
  const secondBoardItem = secondBoard.stages.flatMap((stage) => stage.items).find((candidate) => candidate.id === secondItemData.id)
  expect(secondBoardItem).toBeDefined()

  await page.goto(`/firms/${first.slug}/my-work`)
  await page.getByLabel('Email address').fill(first.email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible()

  const response = await page.evaluate(async ({ workflowId, forgedFirmId }) => {
    const result = await fetch(`/api/forgeboard/workflows/${workflowId}`, {
      headers: { 'X-ForgeBoard-Firm': forgedFirmId },
    })
    return { status: result.status, body: await result.text() }
  }, { workflowId: secondWorkflowData.id, forgedFirmId: secondCredentials.firms[0].id })

  expect(response.status).toBe(404)
  expect(response.body).not.toContain('Private second-firm workflow')

  const publicResponses = await page.evaluate(async ({ workflowSlug, taskReference, forgedFirmId, workflowId, itemId, requestId }) => Promise.all([
    fetch(`/api/forgeboard/workflows/public/${workflowSlug}`, { headers: { 'X-ForgeBoard-Firm': forgedFirmId } }),
    fetch(`/api/forgeboard/workflows/public/${workflowSlug}/items/${taskReference}`, { headers: { 'X-ForgeBoard-Firm': forgedFirmId } }),
    fetch(`/api/forgeboard/workflows/${workflowId}/items/${itemId}/document-requests/${requestId}`, { method: 'PUT', headers: { 'X-ForgeBoard-Firm': forgedFirmId } }),
  ]).then(async (results) => Promise.all(results.map(async (result) => ({ status: result.status, body: await result.text() })))), {
    workflowSlug: secondBoard.workflowSlug,
    taskReference: secondBoardItem!.taskReference,
    forgedFirmId: secondCredentials.firms[0].id,
    workflowId: secondWorkflowData.id,
    itemId: secondItemData.id,
    requestId: secondDocumentRequestData.id,
  })

  for (const publicResponse of publicResponses) {
    expect(publicResponse.status).toBe(404)
    expect(publicResponse.body).not.toContain('Private second-firm workflow')
    expect(publicResponse.body).not.toContain('Private second-firm task')
  }
})

test('shows a Spring authorization denial and preserves board state for read-only staff', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-readonly-workflow-${suffix.slice(0, 10)}`
  const owner = { email: `e2e-readonly-owner-${suffix}@forgeboard.test`, password: 'playwright-test-password' }
  const reader = { email: `e2e-readonly-reader-${suffix}@forgeboard.test`, password: 'playwright-test-password' }
  const title = `Read only close ${suffix.slice(0, 8)}`

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E Read only ${suffix.slice(0, 8)}`, firmSlug, ownerEmail: owner.email, ownerName: 'Playwright Owner', password: owner.password },
  })
  expect(onboarding.status()).toBe(201)

  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: owner })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string; firms: Array<{ id: string }> }
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'X-ForgeBoard-Firm': credentials.firms[0].id }

  const client = await request.post(`${apiBaseURL}/api/clients`, {
    headers,
    data: { legalName: title, displayName: title, primaryEmail: null },
  })
  expect(client.status()).toBe(201)
  const clientData = await client.json() as { id: string }

  const documentRequest = await request.post(`${apiBaseURL}/api/document-requests`, {
    headers,
    data: { clientId: clientData.id, label: 'Read only document', externalReference: null, dueDate: null },
  })
  expect(documentRequest.status()).toBe(201)
  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: 'Read only workflow', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(workflow.status()).toBe(201)
  const workflowData = await workflow.json() as { id: string; stages: Array<{ id: string }> }

  const item = await request.post(`${apiBaseURL}/api/workflows/${workflowData.id}/items`, {
    headers,
    data: { clientId: clientData.id, stageId: workflowData.stages[0].id, title, description: '', dueDate: null, priority: 'NORMAL' },
  })
  expect(item.status()).toBe(201)
  const itemData = await item.json() as { id: string }
  const boardData = await canonicalWorkflowBoard(request, headers, workflowData.id)
  const createdItem = boardData.stages.flatMap((stage) => stage.items).find((candidate) => candidate.id === itemData.id)
  expect(createdItem).toBeDefined()

  const provision = await request.post(`${apiBaseURL}/api/identity/employees`, {
    headers,
    data: { displayName: 'Playwright Read only', email: reader.email, temporaryPassword: reader.password, role: 'READ_ONLY' },
  })
  expect(provision.status()).toBe(201)

  const boardPath = `/firms/${firmSlug}/workflow/${boardData.workflowSlug}`
  await page.goto(boardPath)
  await page.getByLabel('Email address').fill(reader.email)
  await page.getByLabel('Password').fill(reader.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(boardPath, { timeout: 15_000 })

  const card = page.getByLabel('Prepare stage').locator('article').filter({ hasText: title })
  await expect(card.getByRole('button', { name: `Open ${title} details` })).toBeVisible({ timeout: 15_000 })
  await card.getByRole('button', { name: `Open ${title} task workspace` }).click()
  await expect(page.getByRole('button', { name: 'Link Read only document' })).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(boardPath)
  await card.getByRole('button', { name: `Move ${title} right` }).click()
  await expect(page.locator('p[role="alert"]:not(#__next-route-announcer__)')).toHaveText('The work item could not be moved.')

  await page.reload()
  await expect(page.getByLabel('Prepare stage').getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByLabel('Review stage').getByRole('heading', { name: title })).toHaveCount(0)
})
