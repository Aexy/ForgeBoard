// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clientsApi } from './clients-transport'
import { makeStore } from '@/store/store'
const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }; const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }
describe('clients transport', () => { beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }))))
  it('posts through the BFF and refreshes only the mutated firm directory', async () => { const store = makeStore(); await Promise.all([store.dispatch(clientsApi.endpoints.getClients.initiate({ firm: firmA })), store.dispatch(clientsApi.endpoints.getClients.initiate({ firm: firmB }))]); await store.dispatch(clientsApi.endpoints.createClient.initiate({ firm: firmA, details: { legalName: 'Hearth Bakery', displayName: 'Hearth', primaryEmail: '' } })); await new Promise((resolve) => setTimeout(resolve, 0)); const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request); expect(requests.find((request) => request.method === 'POST')?.url).toContain('/api/forgeboard/clients'); expect(requests.filter((request) => request.url.endsWith('/api/forgeboard/clients'))).toHaveLength(4) }) })
