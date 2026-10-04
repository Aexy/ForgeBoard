import { expect, test } from '@playwright/test'

import { apiBaseURL, createFirm, headers as firmHeaders, signInAt } from './helpers'

test('previews and corrects CSV before importing clients, persists them, and blocks duplicates', async ({ page, request }) => {
  const firm = await createFirm(request, 'csv-import')
  const otherFirm = await createFirm(request, 'csv-other')
  const clientName = `CSV Müller ${firm.suffix.slice(0, 8)}`
  const header = 'legalName,displayName,primaryEmail\n'
  const csv = `${header}${clientName},${clientName},csv-${firm.suffix}@forgeboard.test\n`
  await signInAt(page, `/firms/${firm.slug}/clients`, firm.owner)
  await page.getByText('Import clients from CSV', { exact: true }).click()
  const file = page.getByLabel('CSV file')
  await file.setInputFiles({ name: 'clients.csv', mimeType: 'text/csv', buffer: Buffer.from(`${header},${clientName},invalid-email\n`) })
  await page.getByRole('button', { name: 'Preview CSV', exact: true }).click()
  const commit = page.getByRole('button', { name: 'Import clients', exact: true })
  await expect(commit).toBeDisabled()
  await expect(page.getByRole('table')).toContainText(clientName)
  await expect(page.getByRole('table')).toContainText('legalName is required')
  await expect(page.getByRole('table')).toContainText('primaryEmail is invalid')
  let clients = await request.get(`${apiBaseURL}/api/clients`, { headers: firmHeaders(firm) })
  expect(clients.status()).toBe(200)
  expect(await clients.json()).toEqual([])

  await file.setInputFiles({ name: 'corrected.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(commit).toHaveCount(0)
  await page.getByRole('button', { name: 'Preview CSV', exact: true }).click()
  await expect(commit).toBeEnabled()
  clients = await request.get(`${apiBaseURL}/api/clients`, { headers: firmHeaders(firm) })
  expect(clients.status()).toBe(200)
  expect(await clients.json()).toEqual([])
  await commit.click()
  await expect(page.getByRole('status')).toHaveText('Clients imported: 1')
  await expect(page.getByRole('heading', { name: clientName, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: clientName, exact: true })).toBeVisible()

  await page.getByText('Import clients from CSV', { exact: true }).click()
  await file.setInputFiles({ name: 'duplicate.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Preview CSV', exact: true }).click()
  await expect(commit).toBeDisabled()
  await expect(page.getByRole('table')).toContainText('Duplicate legalName')
  clients = await request.get(`${apiBaseURL}/api/clients`, { headers: firmHeaders(firm) })
  expect(clients.status()).toBe(200)
  expect(await clients.json()).toHaveLength(1)
  const otherClients = await request.get(`${apiBaseURL}/api/clients`, { headers: firmHeaders(otherFirm) })
  expect(otherClients.status()).toBe(200)
  expect(await otherClients.json()).toEqual([])
})

test('persists the German language choice through Auth.js and direct firm routes', async ({ page, request }) => {
  const { suffix, slug: firmSlug, owner: { email, password } } = await createFirm(request, 'language')
  const clientName = `E2E Client ${suffix.slice(0, 8)}`

  await page.goto(`/firms/${firmSlug}/my-work`)
  await expect(page).toHaveURL(`/sign-in?callbackUrl=${encodeURIComponent(`/firms/${firmSlug}/my-work`)}`)
  await page.getByRole('button', { name: 'Deutsch' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(`/firms/${firmSlug}/my-work`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Meine Aufgaben' })).toBeVisible()

  await page.getByRole('link', { name: 'Mandanten' }).click()
  await expect(page).toHaveURL(`/firms/${firmSlug}/clients`)
  await page.getByRole('button', { name: '+ Neuer Mandant' }).click()
  await page.getByLabel('Rechtlicher Name').fill(clientName)
  await page.getByLabel('Anzeigename').fill(clientName)
  await page.getByLabel('Primäre E-Mail-Adresse').fill(`contact-${suffix}@forgeboard.test`)
  await page.getByRole('button', { name: 'Mandant speichern' }).click()
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(`/firms/${firmSlug}/clients`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('link', { name: 'Meine Aufgaben' })).toBeVisible()
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible()
})

test('opens assigned work from My work and preserves the direct task link', async ({ page, request }) => {
  const firm = await createFirm(request, 'my-work')
  const { suffix, slug: firmSlug, owner: { email, password } } = firm
  const title = `Assigned close ${suffix.slice(0, 8)}`
  const headers = firmHeaders(firm)

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
    data: { name: 'My work workflow', stages: [{ name: 'Prepare', attention: 'NONE', finalStage: false }, { name: 'Review', attention: 'AWAITING_REVIEW', finalStage: false }, { name: 'Complete', attention: 'NONE', finalStage: true }] },
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
  await signInAt(page, myWorkPath, { email, password })
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
