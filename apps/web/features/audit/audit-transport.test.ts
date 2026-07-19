// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auditApi } from './audit-transport'
import { makeStore } from '@/store/store'
const firm = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
describe('audit transport', () => { beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { headers: { 'Content-Type': 'application/json' } }))))
  it('sends an inclusive audit-trail end date with nanosecond precision', async () => { await makeStore().dispatch(auditApi.endpoints.getAuditTrail.initiate({ firm, filters: { from: '2026-07-01', to: '2026-07-31' }, size: 50 })); const request = vi.mocked(fetch).mock.calls[0][0] as Request; expect(new URL(request.url).searchParams.get('to')).toBe('2026-07-31T23:59:59.999999999Z') }) })
