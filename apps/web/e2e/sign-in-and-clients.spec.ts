import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'

test('signs in through Auth.js and persists client work on direct firm routes', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-${suffix.slice(0, 16)}`
  const email = `e2e-${suffix}@forgeboard.test`
  const password = 'playwright-test-password'
  const clientName = `E2E Client ${suffix.slice(0, 8)}`

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: {
      firmName: `E2E Firm ${suffix.slice(0, 8)}`,
      firmSlug,
      ownerEmail: email,
      ownerName: 'Playwright Owner',
      password,
    },
  })
  expect(onboarding.status(), 'Spring must be running with a writable local database').toBe(201)

  await page.goto(`/firms/${firmSlug}/my-work`)
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Ffirms%2F/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(`/firms/${firmSlug}/my-work`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible()

  await page.getByRole('link', { name: 'Clients' }).click()
  await expect(page).toHaveURL(`/firms/${firmSlug}/clients`)
  await page.getByRole('button', { name: '+ New client' }).click()
  await page.getByLabel('Legal name').fill(clientName)
  await page.getByLabel('Display name').fill(clientName)
  await page.getByLabel('Primary email').fill(`contact-${suffix}@forgeboard.test`)
  await page.getByRole('button', { name: 'Save client' }).click()
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(`/firms/${firmSlug}/clients`)
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible()
})

test('opens assigned work from My work and preserves the direct task link', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-my-work-${suffix.slice(0, 12)}`
  const email = `e2e-my-work-${suffix}@forgeboard.test`
  const password = 'playwright-test-password'
  const title = `Assigned close ${suffix.slice(0, 8)}`

  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E My work ${suffix.slice(0, 8)}`, firmSlug, ownerEmail: email, ownerName: 'Playwright Owner', password },
  })
  expect(onboarding.status()).toBe(201)

  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: { email, password } })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string; firms: Array<{ id: string }> }
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'X-ForgeBoard-Firm': credentials.firms[0].id }

  const employees = await request.get(`${apiBaseURL}/api/identity/employees`, { headers })
  expect(employees.status()).toBe(200)
  const owner = (await employees.json() as Array<{ userId: string; email: string }>).find((employee) => employee.email === email)
  expect(owner).toBeDefined()

  const client = await request.post(`${apiBaseURL}/api/clients`, {
    headers,
    data: { legalName: title, displayName: title, primaryEmail: null },
  })
  expect(client.status()).toBe(201)
  const clientData = await client.json() as { id: string }

  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: 'My work workflow', stages: [{ name: 'Prepare', attention: 'NONE' }, { name: 'Review', attention: 'AWAITING_REVIEW' }] },
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

  const assignment = await request.put(`${apiBaseURL}/api/workflows/${workflowData.id}/items/${itemData.id}/owner`, {
    headers,
    data: { ownerUserId: owner!.userId },
  })
  expect(assignment.status()).toBe(200)

  const myWorkPath = `/firms/${firmSlug}/my-work`
  const taskPath = `/firms/${firmSlug}/workflow/${boardData.workflowSlug}/tasks/${createdItem!.taskReference}`
  await page.goto(myWorkPath)
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Ffirms%2F/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(myWorkPath, { timeout: 15_000 })
  const taskLink = page.getByRole('link', { name: new RegExp(title) })
  await expect(taskLink).toBeVisible()
  await taskLink.click()
  await expect(page).toHaveURL(taskPath)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(myWorkPath)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'My work' }).click()
  await expect(page).toHaveURL(myWorkPath)
  await page.reload()
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
})
