import { afterEach, describe, expect, it, vi } from 'vitest'
import { listWorkflows, moveWorkItem } from './workflows'

describe('workflow API', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('scopes workflow reads to the firm', async () => { const fetchMock = vi.fn().mockResolvedValue(new Response('[]')); vi.stubGlobal('fetch', fetchMock); await listWorkflows('firm-1'); expect(fetchMock).toHaveBeenCalledWith('/api/workflows', expect.objectContaining({ headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1' }) })) })
  it('persists a movement with CSRF and the rendered version', async () => { const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf' }))).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'item-1' }))); vi.stubGlobal('fetch', fetchMock); await moveWorkItem('firm-1', 'flow-1', 'item-1', 'review', 3); expect(fetchMock).toHaveBeenLastCalledWith('/api/workflows/flow-1/items/item-1/position', expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ 'X-ForgeBoard-Firm': 'firm-1', 'X-XSRF-TOKEN': 'csrf' }), body: JSON.stringify({ targetStageId: 'review', beforeItemId: null, afterItemId: null, expectedVersion: 3 }) })) })
})
