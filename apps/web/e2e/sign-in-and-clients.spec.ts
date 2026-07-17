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
  await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/)
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
