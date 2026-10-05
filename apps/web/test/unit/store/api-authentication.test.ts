// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signOut = vi.hoisted(() => vi.fn())
vi.mock('next-auth/react', () => ({ signOut }))

import { portfolioApi } from '@/features/portfolio/portfolio-transport'
import { makeStore } from '@/store/store'

const firm = { firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' as const }
const request = (q: string) => ({ firm, filters: { q, attention: [], status: [] }, page: 0, size: 25 })

describe('authenticated API transport', () => {
  beforeEach(() => { signOut.mockResolvedValue(undefined) })
  afterEach(() => { vi.unstubAllGlobals(); signOut.mockReset() })

  it.each([
    ['unmarked 401', () => new Response('{}', { status: 401 })],
    ['403', () => new Response('{}', { status: 403 })],
    ['500', () => new Response('{}', { status: 500 })],
    ['network failure', () => Promise.reject(new TypeError('network unavailable'))],
  ])('does not sign out for %s', async (name, response) => {
    vi.stubGlobal('fetch', vi.fn(response))
    const store = makeStore()
    await store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate(request(name)))
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out for a marked upstream 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {
      status: 401,
      headers: { 'X-ForgeBoard-Reauthenticate': '1' },
    })))
    const store = makeStore()
    await store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate(request('marked')))
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/sign-in' }))
  })
})
