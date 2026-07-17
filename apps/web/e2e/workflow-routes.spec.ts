import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'

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

  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: 'Monthly close', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(workflow.status()).toBe(201)
  const workflowData = await workflow.json() as { id: string; stages: Array<{ id: string }> }

  const item = await request.post(`${apiBaseURL}/api/workflows/${workflowData.id}/items`, {
    headers,
    data: { clientId: clientData.id, stageId: workflowData.stages[0].id, title: urgentTitle, description: '', dueDate: null, priority: 'URGENT' },
  })
  expect(item.status()).toBe(201)
  const itemData = await item.json() as { id: string }

  const savedView = await request.post(`${apiBaseURL}/api/workflows/views`, {
    headers,
    data: { name: 'Urgent work', clientId: null, ownerUserId: null, dueState: null, priority: 'URGENT', unassigned: false },
  })
  expect(savedView.status()).toBe(201)

  const boardPath = `/firms/${firmSlug}/workflow/${workflowData.id}`
  await page.goto(`${boardPath}?priority=URGENT`)
  await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT`, { timeout: 15_000 })

  const cardTitle = page.getByRole('heading', { name: urgentTitle })
  await expect(cardTitle).toBeVisible()
  await cardTitle.click()
  await expect(page).toHaveURL(`${boardPath}?priority=URGENT&task=${itemData.id}`)
  await page.getByRole('button', { name: 'Open task workspace' }).click()
  await expect(page).toHaveURL(`${boardPath}/tasks/${itemData.id}`)
  await expect(page.getByRole('heading', { name: urgentTitle })).toBeVisible()

  await page.goto(boardPath)
  await page.getByRole('button', { name: `Move ${urgentTitle} right` }).click()
  await expect(page.getByRole('alert').filter({ hasText: `${urgentTitle} moved.` })).toHaveText(`${urgentTitle} moved.`)

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

  const boardPath = `/firms/${firmSlug}/workflow/${workflowData.id}`
  await page.goto(boardPath)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 })

  const concurrentMove = await request.patch(`${apiBaseURL}/api/workflows/${workflowData.id}/items/${itemData.id}/position`, {
    headers,
    data: { targetStageId: workflowData.stages[1].id, beforeItemId: null, afterItemId: null, expectedVersion: 0 },
  })
  expect(concurrentMove.status()).toBe(200)

  await page.getByRole('button', { name: `Move ${title} right` }).click()
  await expect(page.locator('p[role="alert"]:not(#__next-route-announcer__)')).toHaveText('This work item was changed by another user. The board was refreshed; retry your move.')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
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
  const secondWorkflowData = await secondWorkflow.json() as { id: string }

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
})
