import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn(() => { throw new Error('REDIRECT') }),
  HomeHero: () => <h1>Public ForgeBoard home</h1>,
  AccessScreen: () => <h1>ForgeBoard access</h1>,
}))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/features/public-site/HomeHero', () => ({ HomeHero: mocks.HomeHero }))
vi.mock('@/app/(auth)/AccessScreen', () => ({ AccessScreen: mocks.AccessScreen }))
import HomePage, { metadata } from '@/app/page'

describe('public home page', () => {
  it('exports route-specific search metadata', () => {
    expect(metadata).toEqual({
      title: 'ForgeBoard | Accounting workflow software',
      description: 'Run recurring client work with clear ownership, review handoffs, and deadline visibility.',
    })
  })

  it('redirects an authenticated user to their first accessible firm', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth' }] })
    await expect(HomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth/my-work')
  })

  it('redirects a platform administrator without firm memberships to platform administration', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin-1' }, firms: [], platformAdministrator: true })

    await expect(HomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')

    expect(mocks.redirect).toHaveBeenCalledWith('/platform-admin')
  })

  it('renders the public home for an anonymous visitor', async () => {
    mocks.redirect.mockClear()
    mocks.auth.mockResolvedValue(null)

    const page = await HomePage({ searchParams: Promise.resolve({}) })

    expect(page.type).toBe(mocks.HomeHero)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('renders the public home instead of redirecting after a failed refresh', async () => {
    mocks.redirect.mockClear()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, error: 'RefreshAccessTokenError', firms: [{ slug: 'hearth' }] })
    const page = await HomePage({ searchParams: Promise.resolve({ callbackUrl: '/firms/hearth/clients' }) })

    expect(page.type).toBe(mocks.HomeHero)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('preserves access for an authenticated user without a firm or platform administration access', async () => {
    mocks.redirect.mockClear()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [] })

    const page = await HomePage({ searchParams: Promise.resolve({}) })

    expect(page.type).toBe(mocks.AccessScreen)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
