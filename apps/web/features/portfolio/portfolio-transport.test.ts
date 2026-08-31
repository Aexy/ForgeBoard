// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { portfolioApi } from './portfolio-transport'
import { makeStore } from '@/store/store'

const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }
const filters = { q: 'Northstar', attention: ['OVERDUE', 'BLOCKED'] as const, status: [] as const }

describe('portfolio transport', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ content: [], page: 0, pageSize: 25, totalElements: 0, totalPages: 0 }), { headers: { 'Content-Type': 'application/json' } }))))

  it('uses only the same-origin BFF and retains immutable firm cache identity', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate({ firm: firmA, filters: { ...filters, attention: [...filters.attention], status: [] }, page: 0, size: 25 })),
      store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate({ firm: firmB, filters: { ...filters, attention: [...filters.attention], status: [] }, page: 0, size: 25 })),
    ])
    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request)
    expect(requests).toHaveLength(2)
    expect(requests[0].url).toContain('/api/forgeboard/engagements/portfolio?')
    const parameters = new URL(requests[0].url).searchParams
    expect(parameters.getAll('attention')).toEqual(['OVERDUE', 'BLOCKED'])
    expect(Object.keys(store.getState().forgeboardApi.queries)).toHaveLength(2)
  })
})
