import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT') }) }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/app/(auth)/sign-in/SignInForm', () => ({ SignInForm: () => null }))
import SignInPage from '@/app/(auth)/sign-in/page'

describe('sign-in route', () => {
  it('redirects an authenticated user without a callback to their first firm My Work route', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth-accounting' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth-accounting/my-work')
  })
  it('preserves a safe firm deep link for an authenticated user', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' }, firms: [{ slug: 'hearth-accounting' }] })
    await expect(SignInPage({ searchParams: Promise.resolve({ callbackUrl: '/firms/hearth-accounting/clients' }) })).rejects.toThrow('REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith('/firms/hearth-accounting/clients')
  })
})
