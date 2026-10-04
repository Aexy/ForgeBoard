// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clientsApi } from './clients-transport'
import { makeStore } from '@/store/store'
const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }; const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }

describe('CSV import transport', () => {
  it('posts raw CSV, leaves previews and rejected commits cached, and refreshes only the importing firm on success', async () => {
    let directoryReads = 0
    let importedRows = 0
    const csv = 'legalName,displayName,primaryEmail\r\n"Hearth, Ltd",Hearth,contact@example.com\r\n'
    const sent: Request[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request
      sent.push(request.clone())
      const body = request.method === 'GET'
        ? [{ id: `directory-${++directoryReads}` }]
        : { dryRun: request.url.endsWith('dryRun=true'), totalRows: 1, validRows: 1, importedRows, rows: [] }
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
    }))
    const store = makeStore()
    const first = store.dispatch(clientsApi.endpoints.getClients.initiate({ firm: firmA }))
    await first
    const second = store.dispatch(clientsApi.endpoints.getClients.initiate({ firm: firmB }))
    await second
    const marker = (firm: typeof firmA | typeof firmB) => clientsApi.endpoints.getClients.select({ firm })(store.getState()).data?.[0].id

    await store.dispatch(clientsApi.endpoints.importClients.initiate({ firm: firmA, csv, dryRun: true })).unwrap()
    expect(sent[2].url).toBe('http://localhost:3000/api/forgeboard/clients/import?dryRun=true')
    expect(sent[2].method).toBe('POST')
    expect(sent[2].headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(await sent[2].text()).toBe(csv)
    expect(directoryReads).toBe(2)

    await store.dispatch(clientsApi.endpoints.importClients.initiate({ firm: firmA, csv, dryRun: false })).unwrap()
    expect(sent[3].url).toContain('/clients/import?dryRun=false')
    expect(directoryReads).toBe(2)
    expect(marker(firmA)).toBe('directory-1')
    expect(marker(firmB)).toBe('directory-2')

    importedRows = 1
    await store.dispatch(clientsApi.endpoints.importClients.initiate({ firm: firmA, csv, dryRun: false })).unwrap()
    await vi.waitFor(() => expect(marker(firmA)).toBe('directory-3'))
    expect(marker(firmB)).toBe('directory-2')
    expect(directoryReads).toBe(3)
    first.unsubscribe(); second.unsubscribe(); store.dispatch(clientsApi.util.resetApiState())
  })
})
describe('clients transport', () => { beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }))))
  it('posts through the BFF and refreshes only the mutated firm directory', async () => { const store = makeStore(); await Promise.all([store.dispatch(clientsApi.endpoints.getClients.initiate({ firm: firmA })), store.dispatch(clientsApi.endpoints.getClients.initiate({ firm: firmB }))]); await store.dispatch(clientsApi.endpoints.createClient.initiate({ firm: firmA, details: { legalName: 'Hearth Bakery', displayName: 'Hearth', primaryEmail: '' } })); await new Promise((resolve) => setTimeout(resolve, 0)); const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request); expect(requests.find((request) => request.method === 'POST')?.url).toContain('/api/forgeboard/clients'); expect(requests.filter((request) => request.url.endsWith('/api/forgeboard/clients'))).toHaveLength(4) }) })
