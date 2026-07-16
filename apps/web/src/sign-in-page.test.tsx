import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT') }), previewEnabled: vi.fn<(slug: string) => boolean>(() => true) }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/app/(auth)/sign-in/SignInForm', () => ({ SignInForm: () => null }))
vi.mock('@/lib/preview-rollout', () => ({ isPreviewFirmEnabled: mocks.previewEnabled }))
import SignInPage from '@/app/(auth)/sign-in/page'

describe('sign-in route', () => {
  it('redirects an authenticated user without a callback to their first preview-enabled firm', async () => {
    mocks.previewEnabled.mockImplementation((slug: string) => slug === 'hearth-accounting')
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'legacy-firm' }, { slug: 'hearth-accounting' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth-accounting/my-work')
  })

  it('redirects an authenticated user without a callback to their first firm My Work route', async () => {
    mocks.previewEnabled.mockReturnValue(true)
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth-accounting' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth-accounting/my-work')
  })
  it('preserves a safe firm deep link for an authenticated user', async () => {
    mocks.previewEnabled.mockReturnValue(true)
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth-accounting' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/firms/hearth-accounting/clients' }) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth-accounting/clients')
  })
})
