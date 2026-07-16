import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMyWorkDashboard } from './employeeDashboard'

describe('employee dashboard API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('bypasses browser caching for the current firm dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ today: '2026-07-16', overdue: [], dueSoon: [], blocked: [], awaitingReview: [], active: [] })))
    vi.stubGlobal('fetch', fetchMock)

    await getMyWorkDashboard('firm-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard/my-work', expect.objectContaining({
      cache: 'no-store',
      credentials: 'include',
      headers: { 'X-ForgeBoard-Firm': 'firm-1' },
    }))
  })
})
