import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), auth: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/app/(auth)/AccessScreen', () => ({ AccessScreen: ({ callbackUrl }: { callbackUrl?: string }) => <p>{callbackUrl ?? 'No callback'}</p> }))
import SignInPage from '@/app/(auth)/sign-in/page'

describe('sign-in route', () => {
  beforeEach(() => { mocks.auth.mockResolvedValue(null); mocks.redirect.mockClear() })
  it('renders the sign-in screen for an anonymous visitor', async () => {
    const page = await SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/firms/hearth-accounting/clients' }) })

    expect(page).toMatchObject({ props: { callbackUrl: '/firms/hearth-accounting/clients' } })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('drops an unsafe callback before rendering the sign-in screen', async () => {
    const page = await SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/sign-in' }) })

    expect(page).toMatchObject({ props: { callbackUrl: undefined } })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('sends an authenticated user directly to their firm instead of hopping through home', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth/my-work')
  })

  it('drops an unsafe callback before redirecting an authenticated user', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth' }] })

    await expect(SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/sign-in' }) })).rejects.toThrow('REDIRECT')

    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth/my-work')
  })

  it('sends a platform administrator without firms to platform administration', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin-1' }, firms: [], platformAdministrator: true })

    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')

    expect(mocks.redirect).toHaveBeenCalledWith('/platform-admin')
  })
})
