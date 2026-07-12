import { afterEach, describe, expect, it, vi } from 'vitest'
import { archiveClient, listClients } from './clients'

describe('client API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scopes client reads to the selected firm', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await listClients('firm-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ credentials: 'include', headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1' }) }))
  })

  it('uses CSRF and tenant headers when archiving', async () => {
    const archived = { id: 'client-1', status: 'ARCHIVED' }
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }))).mockResolvedValueOnce(new Response(JSON.stringify(archived)))
    vi.stubGlobal('fetch', fetchMock)
    await archiveClient('firm-1', 'client-1')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/clients/client-1/archive', expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1', 'X-XSRF-TOKEN': 'csrf' }) }))
  })
})
