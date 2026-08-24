import { randomUUID } from 'node:crypto'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const apiBaseURL = process.env.FORGEBOARD_E2E_API_BASE_URL ?? 'http://127.0.0.1:8080'
const password = 'playwright-test-password'
const platformAdministratorEmail = 'e2e-platform-admin@forgeboard.test'

type Credentials = { email: string; password: string }
type Firm = { id: string; slug: string; owner: Credentials; ownerId: string; token: string }
type AccessLink = { actionId: string; link: string; expiresAt: string }
type Employee = { membershipId: string; userId: string | null; email: string; role: string; status: string }

async function createFirm(request: APIRequestContext, prefix: string, email?: string): Promise<Firm> {
  const suffix = randomUUID().replaceAll('-', '')
  const owner = { email: email ?? `${prefix}-owner-${suffix}@forgeboard.test`, password }
  const onboarding = await request.post(`${apiBaseURL}/api/onboarding/firms`, {
    data: { firmName: `E2E ${prefix} ${suffix.slice(0, 8)}`, firmSlug: `e2e-${prefix}-${suffix.slice(0, 12)}`,
      ownerEmail: owner.email, ownerName: 'Playwright Owner', password: owner.password },
  })
  expect(onboarding.status(), 'Spring must be running with a writable disposable database').toBe(201)
  const created = await onboarding.json() as { firmId: string; ownerId: string; firmSlug: string }
  const grant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: owner })
  expect(grant.status()).toBe(200)
  const credentials = await grant.json() as { accessToken: string }
  return { id: created.firmId, slug: created.firmSlug, owner, ownerId: created.ownerId, token: credentials.accessToken }
}

function headers(firm: Firm) { return { Authorization: `Bearer ${firm.token}`, 'X-ForgeBoard-Firm': firm.id } }
function routePath(link: string) { return new URL(link).pathname }

async function invite(request: APIRequestContext, firm: Firm, displayName: string, email: string, role = 'MEMBER'): Promise<AccessLink> {
  const response = await request.post(`${apiBaseURL}/api/identity/employees`, {
    headers: headers(firm), data: { displayName, email, role },
  })
  expect(response.status()).toBe(201)
  return response.json() as Promise<AccessLink>
}

async function employees(request: APIRequestContext, firm: Firm): Promise<Employee[]> {
  const response = await request.get(`${apiBaseURL}/api/identity/employees`, { headers: headers(firm) })
  expect(response.status()).toBe(200)
  return response.json() as Promise<Employee[]>
}

async function signInAt(page: Page, path: string, credentials: Credentials) {
  await page.goto(path)
  await expect(page).toHaveURL(/\/?(?:\?callbackUrl=%2Ffirms%2F|$)/)
  await page.getByLabel('Email address').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(path, { timeout: 15_000 })
}

async function acceptNewInvitation(page: Page, link: AccessLink, displayName: string, account: Credentials) {
  await page.goto(routePath(link.link))
  await expect(page.getByRole('heading', { name: 'Accept invitation' })).toBeVisible()
  await page.getByLabel('Your name').fill(displayName)
  await page.getByLabel('Password').fill(account.password)
  await page.getByLabel('Confirm password').fill(account.password)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })
}

async function expectGenericInvitationDenial(page: Page, linkPath: string) {
  await page.goto(linkPath)
  await page.getByLabel('Your name').fill('Denied Member')
  await page.getByLabel('Password').fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page.getByRole('alert')).toHaveText('We could not complete this request. The link may be invalid or expired. Please request a new link.')
}

test('accepts new and existing-account invitations through the public Next pages', async ({ page, browser, request }) => {
  const firm = await createFirm(request, 'pilot-access')
  const suffix = randomUUID().replaceAll('-', '')
  const newAccount = { email: `e2e-new-${suffix}@forgeboard.test`, password }
  const newInvitation = await invite(request, firm, 'New Invitee', newAccount.email)

  await acceptNewInvitation(page, newInvitation, 'New Invitee', newAccount)
  await signInAt(page, `/firms/${firm.slug}/my-work`, newAccount)
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible()

  const existingFirm = await createFirm(request, 'existing-account')
  const existingInvitation = await invite(request, firm, 'Existing Invitee', existingFirm.owner.email)
  const existingContext = await browser.newContext()
  const existingPage = await existingContext.newPage()
  await existingPage.goto(routePath(existingInvitation.link))
  await existingPage.getByRole('button', { name: 'I already have an account' }).click()
  await existingPage.getByLabel('Email address').fill(existingFirm.owner.email)
  await existingPage.getByLabel('Password').fill(existingFirm.owner.password)
  await existingPage.getByRole('button', { name: 'Sign in and accept invitation' }).click()
  await expect(existingPage).toHaveURL('/', { timeout: 15_000 })
  await signInAt(existingPage, `/firms/${firm.slug}/my-work`, existingFirm.owner)
  await expect(existingPage.getByRole('heading', { name: 'My work' })).toBeVisible()
  await existingContext.close()
})

test('shows the same generic denial for revoked, reused, and expired access links', async ({ page, request }) => {
  const firm = await createFirm(request, 'pilot-denial')
  const suffix = randomUUID().replaceAll('-', '')
  const revoked = await invite(request, firm, 'Revoked Invitee', `e2e-revoked-${suffix}@forgeboard.test`)
  const revokedMembership = (await employees(request, firm)).find((employee) => employee.email === `e2e-revoked-${suffix}@forgeboard.test`)
  expect(revokedMembership).toBeDefined()
  const revocation = await request.delete(`${apiBaseURL}/api/identity/employees/${revokedMembership!.membershipId}/invitation`, { headers: headers(firm) })
  expect(revocation.status()).toBe(204)
  await expectGenericInvitationDenial(page, routePath(revoked.link))

  const reusableAccount = { email: `e2e-reused-${suffix}@forgeboard.test`, password }
  const reusable = await invite(request, firm, 'Reused Invitee', reusableAccount.email)
  await acceptNewInvitation(page, reusable, 'Reused Invitee', reusableAccount)
  await expectGenericInvitationDenial(page, routePath(reusable.link))

  // The public boundary intentionally makes an expired token indistinguishable from an unknown token.
  await expectGenericInvitationDenial(page, '/invite/expired-access-link')
})

test('denies administrator owner-role changes and cross-firm membership access', async ({ page, request }) => {
  const firm = await createFirm(request, 'pilot-authority')
  const suffix = randomUUID().replaceAll('-', '')
  const administrator = { email: `e2e-admin-${suffix}@forgeboard.test`, password }
  const invitation = await invite(request, firm, 'Pilot Administrator', administrator.email, 'ADMINISTRATOR')
  await acceptNewInvitation(page, invitation, 'Pilot Administrator', administrator)
  const administratorGrant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: administrator })
  expect(administratorGrant.status()).toBe(200)
  const administratorToken = (await administratorGrant.json() as { accessToken: string }).accessToken

  const ownerInvitation = await request.post(`${apiBaseURL}/api/identity/employees`, {
    headers: { Authorization: `Bearer ${administratorToken}`, 'X-ForgeBoard-Firm': firm.id },
    data: { displayName: 'Prohibited Owner', email: `e2e-prohibited-${suffix}@forgeboard.test`, role: 'OWNER' },
  })
  expect(ownerInvitation.status()).toBe(403)

  const administratorMembership = (await employees(request, firm)).find((employee) => employee.email === administrator.email)
  expect(administratorMembership).toBeDefined()
  const otherFirm = await createFirm(request, 'pilot-other')
  const crossFirm = await request.post(`${apiBaseURL}/api/identity/employees/${administratorMembership!.membershipId}/suspension`, {
    headers: headers(otherFirm),
  })
  expect(crossFirm.status()).toBe(404)
})

test('allows a configured platform administrator to reset a password and forces a fresh browser sign-in', async ({ page, request }) => {
  const administrator = await createFirm(request, 'platform-admin', platformAdministratorEmail)
  const target = await createFirm(request, 'reset-target')
  await signInAt(page, `/firms/${target.slug}/my-work`, target.owner)
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible()

  const reset = await request.post(`${apiBaseURL}/api/platform-admin/users/${target.ownerId}/password-reset`, {
    headers: { Authorization: `Bearer ${administrator.token}` },
  })
  expect(reset.status()).toBe(200)
  const link = await reset.json() as AccessLink
  const newPassword = 'new-playwright-test-password'
  await page.goto(routePath(link.link))
  await page.getByLabel('New password').fill(newPassword)
  await page.getByLabel('Confirm new password').fill(newPassword)
  await page.getByRole('button', { name: 'Reset password' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })

  await page.goto(`/firms/${target.slug}/my-work`)
  await expect(page).toHaveURL(/\/?callbackUrl=%2Ffirms%2F/)
  await page.getByLabel('Email address').fill(target.owner.email)
  await page.getByLabel('Password').fill(target.owner.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('We could not sign you in. Check your details and try again.')
  await page.getByLabel('Password').fill(newPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(`/firms/${target.slug}/my-work`, { timeout: 15_000 })
})
