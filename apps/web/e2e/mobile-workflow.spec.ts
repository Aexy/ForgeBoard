import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'

test('keeps the mobile workspace navigation and workflow task flow usable', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-mobile-${suffix.slice(0, 12)}`
  const email = `e2e-mobile-${suffix}@forgeboard.test`
  const password = 'playwright-test-password'
  const title = `Mobile close ${suffix.slice(0, 8)}`

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E Mobile ${suffix.slice(0, 8)}`, firmSlug, ownerEmail: email, ownerName: 'Playwright Owner', password },
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
    data: { name: 'Mobile workflow', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
  })
  expect(workflow.status()).toBe(201)
  const workflowData = await workflow.json() as { id: string; stages: Array<{ id: string }> }

  const item = await request.post(`${apiBaseURL}/api/workflows/${workflowData.id}/items`, {
    headers,
    data: { clientId: clientData.id, stageId: workflowData.stages[0].id, title, description: '', dueDate: null, priority: 'NORMAL' },
  })
  expect(item.status()).toBe(201)
  const itemData = await item.json() as { id: string }

  const board = await request.get(`${apiBaseURL}/api/workflows/${workflowData.id}`, { headers })
  expect(board.status()).toBe(200)
  const boardData = await board.json() as { workflowSlug: string; stages: Array<{ items: Array<{ id: string; taskReference: string }> }> }
  const createdItem = boardData.stages.flatMap((stage) => stage.items).find((candidate) => candidate.id === itemData.id)
  expect(createdItem).toBeDefined()

  const boardPath = `/firms/${firmSlug}/workflow/${boardData.workflowSlug}`
  await page.goto(boardPath)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(boardPath, { timeout: 15_000 })

  const logo = page.getByRole('link', { name: 'ForgeBoard home' }).getByRole('img', { name: 'ForgeBoard' })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('src', '/forgeboard-logo.svg')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'My work' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).click()

  const workflowBoard = page.getByLabel('Mobile workflow workflow')
  await expect(workflowBoard).toBeVisible()

  await page.getByRole('button', { name: `Open ${title} task workspace` }).click()
  await expect(page).toHaveURL(`${boardPath}/tasks/${createdItem!.taskReference}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.goto(boardPath)

  await page.getByRole('button', { name: `Open ${title} details` }).click()
  const panel = page.getByRole('complementary', { name: `${title} details` })
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('position', 'fixed')
})
