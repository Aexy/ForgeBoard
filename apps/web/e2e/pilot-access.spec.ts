import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { apiBaseURL, password, createFirm, headers, signInAt, type Credentials, type Firm } from './helpers'
const platformAdministratorEmail = 'e2e-platform-admin@forgeboard.test'

type AccessLink = { actionId: string; link: string; expiresAt: string }
type Employee = { membershipId: string; userId: string | null; email: string; role: string; status: string }

function routePath(link: string) { return new URL(link).pathname }

function expireAccessAction(token: string) {
  const jdbcUrl = process.env.DB_URL
  const databaseUser = process.env.DB_USER
  const databasePassword = process.env.DB_PASSWORD
  const psql = process.env.FORGEBOARD_E2E_PSQL
  if (!jdbcUrl || !databaseUser || !databasePassword || !psql)
    throw new Error('The supported E2E runner must provide disposable PostgreSQL configuration to expire an access action')

  const connection = new URL(jdbcUrl.replace(/^jdbc:/, ''))
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const sql = `update access_actions set expires_at = created_at + interval '1 millisecond' where token_hash = '${tokenHash}' returning id;`
  const output = execFileSync(psql, [
    '-h', connection.hostname,
    '-p', String(connection.port ? Number(connection.port) : 5432),
    '-U', databaseUser,
    '-d', connection.pathname.slice(1),
    '-w', '-tAc', sql,
  ], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: databasePassword } })
  expect(output.trim(), 'the authenticated API-created action must be expired in the disposable test database').not.toBe('')
}

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

async function acceptNewInvitation(page: Page, link: AccessLink, displayName: string, account: Credentials) {
  await page.goto(routePath(link.link))
  await expect(page.getByRole('heading', { name: 'Accept your invitation' })).toBeVisible()
  await page.getByLabel('Your name').fill(displayName)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByLabel('Confirm password').fill(account.password)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page).toHaveURL('/sign-in', { timeout: 15_000 })
}

async function expectGenericInvitationDenial(page: Page, linkPath: string) {
  const genericDenial = 'We could not complete this request. The link may be invalid or expired. Please ask for a new one.'
  await page.goto(linkPath)
  await page.getByLabel('Your name').fill('Denied Member')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page.getByRole('alert').filter({ hasText: genericDenial })).toHaveText(genericDenial)
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
  await expect(existingPage).toHaveURL('/sign-in', { timeout: 15_000 })
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

  const expired = await invite(request, firm, 'Expired Invitee', `e2e-expired-${suffix}@forgeboard.test`)
  expireAccessAction(routePath(expired.link).split('/').at(-1)!)
  await expectGenericInvitationDenial(page, routePath(expired.link))
})

test('denies administrator owner-role changes and cross-firm membership access', async ({ request }) => {
  const firm = await createFirm(request, 'pilot-authority')
  const suffix = randomUUID().replaceAll('-', '')
  const administrator = await createFirm(request, 'pilot-administrator')
  const invitation = await invite(request, firm, 'Pilot Administrator', administrator.owner.email, 'ADMINISTRATOR')
  const acceptance = await request.post(`${apiBaseURL}/api/access/invitations/${routePath(invitation.link).split('/').at(-1)}/accept-existing`, {
    headers: { Authorization: `Bearer ${administrator.token}` },
  })
  expect(acceptance.status()).toBe(204)
  const administratorGrant = await request.post(`${apiBaseURL}/api/auth/grant`, { data: administrator.owner })
  expect(administratorGrant.status()).toBe(200)
  const administratorToken = (await administratorGrant.json() as { accessToken: string }).accessToken
  await expect.poll(async () => (await request.get(`${apiBaseURL}/api/identity/firms`, {
    headers: { Authorization: `Bearer ${administratorToken}` },
  })).status()).toBe(200)

  const ownerInvitation = await request.post(`${apiBaseURL}/api/identity/employees`, {
    headers: { Authorization: `Bearer ${administratorToken}`, 'X-ForgeBoard-Firm': firm.id },
    data: { displayName: 'Prohibited Owner', email: `e2e-prohibited-${suffix}@forgeboard.test`, role: 'OWNER' },
  })
  expect(ownerInvitation.status()).toBe(403)

  const administratorMembership = (await employees(request, firm)).find((employee) => employee.email === administrator.owner.email)
  expect(administratorMembership).toBeDefined()
  const otherFirm = await createFirm(request, 'pilot-other')
  const crossFirm = await request.post(`${apiBaseURL}/api/identity/employees/${administratorMembership!.membershipId}/suspension`, {
    headers: headers(otherFirm),
  })
  expect(crossFirm.status()).toBe(404)
})

test('allows a configured platform administrator to reset a password and forces a fresh browser sign-in', async ({ page, browser, request }) => {
  const administrator = await createFirm(request, 'platform-admin', platformAdministratorEmail)
  const target = await createFirm(request, 'reset-target')
  await signInAt(page, `/firms/${target.slug}/my-work`, target.owner)
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible()
  const targetMembership = (await employees(request, target)).find((employee) => employee.userId === target.ownerId)
  expect(targetMembership).toBeDefined()

  const reset = await request.post(`${apiBaseURL}/api/platform-admin/firms/${target.id}/employees/${targetMembership!.membershipId}/password-reset`, {
    headers: { Authorization: `Bearer ${administrator.token}` },
  })
  expect(reset.status()).toBe(200)
  const link = await reset.json() as AccessLink
  const newPassword = 'new-playwright-test-password'
  const resetContext = await browser.newContext()
  const resetPage = await resetContext.newPage()
  await resetPage.goto(routePath(link.link))
  await resetPage.getByLabel('New password', { exact: true }).fill(newPassword)
  await resetPage.getByLabel('Confirm new password').fill(newPassword)
  await resetPage.getByRole('button', { name: 'Reset password' }).click()
  await expect(resetPage).toHaveURL('/sign-in', { timeout: 15_000 })
  await resetContext.close()

  const protectedPath = `/firms/${target.slug}/my-work`
  await page.goto(protectedPath)
  await expect(page).not.toHaveURL(new RegExp(`${protectedPath}$`))
  await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(protectedPath)}`)
  await page.getByLabel('Email address').fill(target.owner.email)
  await page.getByLabel('Password').fill(target.owner.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('p[role="alert"]')).toHaveText('We could not sign you in. Check your details and try again.')
  await page.getByLabel('Password').fill(newPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(`/firms/${target.slug}/my-work`, { timeout: 15_000 })
})
