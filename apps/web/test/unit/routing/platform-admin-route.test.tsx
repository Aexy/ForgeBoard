// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: vi.fn(() => { throw new Error('REDIRECT') }),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/features/platform-admin/PlatformAdminDashboard', () => ({ PlatformAdminDashboard: () => <h1>Platform administration</h1> }))

import PlatformAdminLayout from '@/app/platform-admin/layout'
import PlatformAdminPage from '@/app/platform-admin/page'

describe('platform administration route', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the protected boundary for a platform administrator without firm memberships', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 'platform-admin-1', email: 'owner@example.com' },
      firms: [],
      platformAdministrator: true,
    })

    render(await PlatformAdminLayout({ children: <PlatformAdminPage /> }))

    expect(screen.getByRole('heading', { name: 'Platform administration' })).toBeVisible()
  })

  it('redirects an anonymous or refresh-failed session to sign-in', async () => {
    mocks.auth.mockResolvedValue(null)
    await expect(PlatformAdminLayout({ children: <p>Restricted</p> })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in')

    mocks.redirect.mockClear()
    mocks.auth.mockResolvedValue({ user: { id: 'platform-admin-1', email: 'owner@example.com' }, error: 'RefreshAccessTokenError' })
    await expect(PlatformAdminLayout({ children: <p>Restricted</p> })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in')
  })

  it('does not expose the route to an ordinary authenticated user', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 'firm-user-1', email: 'member@example.com' },
      firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth', role: 'MEMBER' }],
      platformAdministrator: false,
    })

    await expect(PlatformAdminLayout({ children: <p>Restricted</p> })).rejects.toThrow('NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })
})
