import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), auth: vi.fn(), enabled: vi.fn(() => true) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/preview-rollout', () => ({ isPreviewFirmEnabled: mocks.enabled }))
import SignInPage from '@/app/(auth)/sign-in/page'

describe('sign-in route', () => {
  beforeEach(() => { mocks.auth.mockResolvedValue(null); mocks.redirect.mockClear() })
  it('redirects the compatibility sign-in route to the public landing page', async () => {
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/')
  })

  it('preserves a safe firm deep link through the landing page', async () => {
    await expect(SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/firms/hearth-accounting/clients' }) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/?callbackUrl=%2Ffirms%2Fhearth-accounting%2Fclients')
  })

  it('drops a callback that would send an authenticated user back to sign-in', async () => {
    await expect(SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/sign-in' }) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/')
  })

  it('sends an authenticated user directly to their firm instead of hopping through home', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth/my-work')
  })
})
