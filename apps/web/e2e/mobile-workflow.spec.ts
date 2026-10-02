import { expect, test } from '@playwright/test'

import { apiBaseURL, createFirm, headers as firmHeaders, signInAt } from './helpers'

test('keeps the mobile workspace navigation and workflow task flow usable', async ({ page, request }) => {
  const firm = await createFirm(request, 'mobile')
  const { suffix, slug: firmSlug } = firm
  const title = `Mobile close ${suffix.slice(0, 8)}`
  const reviewTitle = `Mobile review ${suffix.slice(0, 8)}`
  const headers = firmHeaders(firm)

  const client = await request.post(`${apiBaseURL}/api/clients`, {
    headers,
    data: { legalName: title, displayName: title, primaryEmail: null },
  })
  expect(client.status()).toBe(201)
  const clientData = await client.json() as { id: string }

  const workflow = await request.post(`${apiBaseURL}/api/workflows`, {
    headers,
    data: { name: 'Mobile workflow', stages: [{ name: 'Prepare', attention: 'NONE', finalStage: false }, { name: 'Review', attention: 'AWAITING_REVIEW', finalStage: false }, { name: 'Complete', attention: 'NONE', finalStage: true }] },
  })
  expect(workflow.status()).toBe(201)
  const workflowData = await workflow.json() as { id: string; stages: Array<{ id: string }> }

  const item = await request.post(`${apiBaseURL}/api/workflows/${workflowData.id}/items`, {
    headers,
    data: { clientId: clientData.id, stageId: workflowData.stages[0].id, title, description: '', dueDate: null, priority: 'NORMAL' },
  })
  expect(item.status()).toBe(201)
  const itemData = await item.json() as { id: string }

  const reviewItem = await request.post(`${apiBaseURL}/api/workflows/${workflowData.id}/items`, {
    headers,
    data: { clientId: clientData.id, stageId: workflowData.stages[1].id, title: reviewTitle, description: '', dueDate: null, priority: 'NORMAL' },
  })
  expect(reviewItem.status()).toBe(201)

  const board = await request.get(`${apiBaseURL}/api/workflows/${workflowData.id}`, { headers })
  expect(board.status()).toBe(200)
  const boardData = await board.json() as { workflowSlug: string; stages: Array<{ items: Array<{ id: string; taskReference: string }> }> }
  const createdItem = boardData.stages.flatMap((stage) => stage.items).find((candidate) => candidate.id === itemData.id)
  expect(createdItem).toBeDefined()

  const boardPath = `/firms/${firmSlug}/workflow/${boardData.workflowSlug}`
  await signInAt(page, boardPath, firm.owner)

  const logo = page.getByRole('link', { name: 'ForgeBoard home' }).getByRole('img', { name: 'ForgeBoard' })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('src', '/forgeboard-logo.svg')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'My work' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).click()

  const workflowBoard = page.getByLabel('Mobile workflow workflow')
  await expect(workflowBoard).toBeVisible()
  expect(await workflowBoard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Toggle stage Prepare' })).toHaveAttribute('aria-expanded', 'true')
  const reviewToggle = page.getByRole('button', { name: 'Toggle stage Review' })
  await expect(reviewToggle).toHaveAttribute('aria-expanded', 'false')
  await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: `Open ${reviewTitle} details` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add work item to Review' })).toBeVisible()

  await page.getByRole('button', { name: `Open ${title} task workspace` }).click()
  await expect(page).toHaveURL(`${boardPath}/tasks/${createdItem!.taskReference}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.goto(boardPath)

  await page.getByRole('button', { name: `Open ${title} details` }).click()
  const panel = page.getByRole('complementary', { name: `${title} details` })
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('position', 'fixed')
})
