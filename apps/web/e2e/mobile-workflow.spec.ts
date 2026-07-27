import { randomUUID } from 'node:crypto'

import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'

test.use({ viewport: { width: 390, height: 844 } })

type TouchPoint = { x: number; y: number }

async function centerOf(locator: Locator): Promise<TouchPoint> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('The touch target is not visible.')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function dispatchTouch(session: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', point?: TouchPoint) {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point ? [{ x: point.x, y: point.y }] : [],
  })
}

async function shortTouchScroll(session: CDPSession, handle: Locator, assertDragInactive: () => Promise<void>) {
  const start = await centerOf(handle)
  await dispatchTouch(session, 'touchStart', start)
  await new Promise((resolve) => setTimeout(resolve, 60))
  await dispatchTouch(session, 'touchMove', { x: start.x, y: start.y - 24 })
  try {
    await assertDragInactive()
  } finally {
    await dispatchTouch(session, 'touchEnd')
  }
}

async function deliberateTouchDrag(session: CDPSession, handle: Locator, target: Locator) {
  const start = await centerOf(handle)
  const end = await centerOf(target)
  await dispatchTouch(session, 'touchStart', start)
  await new Promise((resolve) => setTimeout(resolve, 220))
  await dispatchTouch(session, 'touchMove', end)
  await dispatchTouch(session, 'touchEnd')
}

async function assertImmediatePanelAndDisclosureSemantics(page: Page, filteredBoardPath: string, taskReference: string, title: string) {
  const reviewToggle = page.getByRole('button', { name: 'Toggle stage Review' })
  await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute('aria-expanded', 'false')
  await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute('aria-expanded', 'true')

  await page.getByRole('button', { name: `Open ${title} details` }).click()
  await expect(page).toHaveURL(`${filteredBoardPath}&task=${taskReference}`)
  const panel = page.getByRole('complementary', { name: `${title} details` })
  await expect(panel).toHaveAttribute('data-state', 'open')
  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(filteredBoardPath)
  await expect(panel).toHaveCount(0)
}

test('keeps the mobile workspace navigation and workflow task flow usable', async ({ page, request }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const firmSlug = `e2e-mobile-${suffix.slice(0, 12)}`
  const email = `e2e-mobile-${suffix}@forgeboard.test`
  const password = 'playwright-test-password'
  const title = `Mobile close ${suffix.slice(0, 8)}`
  const reviewTitle = `Mobile review ${suffix.slice(0, 8)}`

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
  expect(await workflowBoard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Toggle stage Prepare' })).toHaveAttribute('aria-expanded', 'true')
  const reviewToggle = page.getByRole('button', { name: 'Toggle stage Review' })
  await expect(reviewToggle).toHaveAttribute('aria-expanded', 'false')
  await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: `Open ${reviewTitle} details` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add work item to Review' })).toBeVisible()

  const prepareCard = page.getByLabel('Prepare stage').locator('article').filter({ hasText: title })
  const dragHandle = prepareCard.getByRole('button', { name: `Move ${createdItem!.taskReference}: ${title}` })
  const touchSession = await page.context().newCDPSession(page)
  await shortTouchScroll(touchSession, dragHandle, async () => {
    expect(await prepareCard.getAttribute('data-dragging')).toBeNull()
  })
  await expect(page.locator('p[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0)
  await expect(page.getByLabel('Prepare stage').getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByLabel('Review stage').getByRole('heading', { name: title })).toHaveCount(0)

  await deliberateTouchDrag(touchSession, dragHandle, page.getByLabel('Review stage'))
  await expect(page.getByRole('alert').filter({ hasText: `${title} moved.` })).toHaveText(`${title} moved.`)
  await expect(page.getByLabel('Review stage').getByRole('heading', { name: title })).toBeVisible()

  await page.getByRole('button', { name: `Open ${title} task workspace` }).click()
  await expect(page).toHaveURL(`${boardPath}/tasks/${createdItem!.taskReference}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const filteredBoardPath = `${boardPath}?priority=NORMAL`
  await page.goto(filteredBoardPath)

  await assertImmediatePanelAndDisclosureSemantics(page, filteredBoardPath, createdItem!.taskReference, title)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await assertImmediatePanelAndDisclosureSemantics(page, filteredBoardPath, createdItem!.taskReference, title)
})
