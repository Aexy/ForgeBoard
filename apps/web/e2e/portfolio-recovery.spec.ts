import { expect, test } from '@playwright/test'

import { createFirm, signInAt } from './helpers'

test('keeps the filtered portfolio and session usable after retrying a server failure', async ({ page, request }) => {
  const firm = await createFirm(request, 'portfolio-recovery')
  const portfolioPath = `/firms/${firm.slug}/portfolio?q=Northstar&attention=OVERDUE`
  let attempts = 0
  await page.route('**/api/forgeboard/engagements/portfolio**', async (route) => {
    attempts += 1
    await route.fulfill(attempts === 1
      ? { status: 500, contentType: 'application/json', body: '{"error":"temporary failure"}' }
      : { status: 200, contentType: 'application/json', body: '{"content":[],"page":0,"pageSize":25,"totalElements":0,"totalPages":0}' })
  })

  await signInAt(page, portfolioPath, firm.owner)
  await expect(page.getByText('The engagement portfolio could not be loaded.')).toBeVisible()
  await expect(page).toHaveURL(portfolioPath)

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'No engagements found' })).toBeVisible()
  await expect(page.getByLabel('Search engagements')).toHaveValue('Northstar')
  await expect(page.getByRole('checkbox', { name: 'Overdue' })).toBeChecked()
  await expect(page).toHaveURL(portfolioPath)

  await page.getByRole('link', { name: 'Clients' }).click()
  await expect(page).toHaveURL(`/firms/${firm.slug}/clients`)
  await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible()
})
