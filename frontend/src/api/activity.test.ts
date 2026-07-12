import { afterEach, describe, expect, it, vi } from 'vitest'
import { listActivity } from './activity'

describe('activity API', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('loads recent activity in the selected tenant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await listActivity('firm-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/activity', { credentials: 'include', headers: { 'X-ForgeBoard-Firm': 'firm-1' } })
  })
})
