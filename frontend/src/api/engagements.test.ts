import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEngagementInstance, listEngagementTemplates } from './engagements'

describe('engagement API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scopes template reads to the selected firm', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await listEngagementTemplates('firm-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/engagements/templates', expect.objectContaining({ headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1' }) }))
  })

  it('uses CSRF and tenant headers when starting an engagement', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }))).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'engagement-1' })))
    vi.stubGlobal('fetch', fetchMock)
    await createEngagementInstance('firm-1', 'template-1', { clientId: 'client-1', periodStart: '2026-07-01' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/engagements/templates/template-1/instances', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1', 'X-XSRF-TOKEN': 'csrf' }) }))
  })
})
