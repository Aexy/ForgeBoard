import { afterEach, describe, expect, it, vi } from 'vitest'
import { listActivity, listAuditTrail } from './activity'

describe('activity API', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('loads recent activity in the selected tenant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await listActivity('firm-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/activity', { credentials: 'include', headers: { 'X-ForgeBoard-Firm': 'firm-1' } })
  })

  it('encodes structured audit-trail filters for the selected tenant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"items":[],"nextCursor":null}'))
    vi.stubGlobal('fetch', fetchMock)
    await listAuditTrail('firm-1', { action: 'work-item.moved', actorType: 'USER', from: '2026-07-01', to: '2026-07-02' }, 'next')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/activity/audit-trail?limit=50&action=work-item.moved&actorType=USER&from=2026-07-01T00%3A00%3A00.000Z&to=2026-07-02T23%3A59%3A59.999Z&cursor=next'),
      { credentials: 'include', headers: { 'X-ForgeBoard-Firm': 'firm-1' } },
    )
  })
})
