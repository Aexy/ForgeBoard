// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { employeesApi } from './employees-transport'
import { makeStore } from '@/store/store'

const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }

describe('employees transport', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request
    const payload = request.method === 'POST'
      ? { actionId: 'action-1', link: 'https://forgeboard.example/invite/one-time', expiresAt: '2026-08-25T12:00:00Z' }
      : []
    return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } })
  })))

  it('generates an invitation through the BFF and refreshes only that immutable firm directory', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(employeesApi.endpoints.getEmployees.initiate({ firm: firmA })),
      store.dispatch(employeesApi.endpoints.getEmployees.initiate({ firm: firmB })),
    ])

    await store.dispatch(employeesApi.endpoints.generateInvitation.initiate({
      firm: firmA,
      request: { displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request)
    const invitation = requests.find((request) => request.method === 'POST')
    expect(invitation?.url).toContain('/api/forgeboard/identity/employees')
    expect(await invitation?.clone().json()).toEqual({ displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' })
    // Two directory requests, one invitation, then exactly one firm-local refetch.
    expect(requests.filter((request) => request.url.includes('identity/employees'))).toHaveLength(4)
  })
})
