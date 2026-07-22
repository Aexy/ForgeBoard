import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT') }), enabled: vi.fn(() => true) }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/preview-rollout', () => ({ isPreviewFirmEnabled: mocks.enabled }))
vi.mock('@/app/(auth)/AccessScreen', () => ({ AccessScreen: () => null }))
import HomePage from '@/app/page'

describe('public home page', () => {
  it('redirects an authenticated user to the first permitted firm', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth' }] })
    await expect(HomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth/my-work')
  })

  it('renders access instead of redirecting after a failed refresh', async () => {
    mocks.redirect.mockClear()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, error: 'RefreshAccessTokenError', firms: [{ slug: 'hearth' }] })
    await expect(HomePage({ searchParams: Promise.resolve({ callbackUrl: '/firms/hearth/clients' }) })).resolves.toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
