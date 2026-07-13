import { afterEach, describe, expect, it, vi } from 'vitest'
import { listDocumentRequests, markDocumentRequestReceived } from './documentRequests'

describe('document request API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scopes document request reads to the selected firm', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await listDocumentRequests('firm-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/document-requests', expect.objectContaining({ headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1' }) }))
  })

  it('uses CSRF and tenant headers when marking a request received', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }))).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'request-1', status: 'RECEIVED' })))
    vi.stubGlobal('fetch', fetchMock)
    await markDocumentRequestReceived('firm-1', 'request-1')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/document-requests/request-1/received', expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1', 'X-XSRF-TOKEN': 'csrf' }) }))
  })
})
