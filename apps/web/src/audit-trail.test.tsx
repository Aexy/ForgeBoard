// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), useGetAuditTrailQuery: vi.fn() }))
const router = { replace: vi.fn() }
let search = new URLSearchParams('action=work-item.moved&size=25')
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => search }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/store/api', () => ({ useGetAuditTrailQuery: mocks.useGetAuditTrailQuery }))

import { AuditTrail, auditSearchFromParams } from '@/features/audit/AuditTrail'

describe('Audit trail route feature', () => {
  beforeEach(() => { router.replace.mockReset(); mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.useGetAuditTrailQuery.mockReturnValue({ isLoading: false, data: { items: [{ actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.moved', targetType: 'work-item', targetId: 'item-1', summary: { title: 'July close' }, occurredAt: '2026-07-16T10:00:00Z' }], nextCursor: 'next-cursor' } }) })
  afterEach(cleanup)

  it('hydrates direct-route filters and moves to the backend cursor page', () => {
    render(<AuditTrail basePath="/firms/hearth/audit-trail" />)
    expect(screen.getByLabelText('Action')).toHaveValue('work-item.moved')
    expect(mocks.useGetAuditTrailQuery).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), size: 25 }), { skip: false })
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(router.replace).toHaveBeenCalledWith('/firms/hearth/audit-trail?action=work-item.moved&cursor=next-cursor&size=25')
  })

  it('replaces invalid filters with safe defaults and keeps the route tenant-scoped', () => {
    expect(auditSearchFromParams(new URLSearchParams('actorType=INVALID&source=NOPE&from=nope&to=2026-02-31&cursor=not-a-cursor&size=999'))).toEqual({ size: 50 })
    expect(auditSearchFromParams(new URLSearchParams('from=2026-08-01&to=2026-07-31'))).toEqual({ size: 50 })
    render(<AuditTrail basePath="/firms/hearth/audit-trail" />)
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'MCP' } })
    expect(router.replace).toHaveBeenLastCalledWith('/firms/hearth/audit-trail?action=work-item.moved&source=MCP&size=25')
  })

  it('retains only Spring-compatible audit cursor encodings', () => {
    const cursor = btoa('2026-07-16T10:00:00Z|7ad4142e-995b-4da5-9f0e-a16fb52f4d42').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
    expect(auditSearchFromParams(new URLSearchParams(`cursor=${cursor}`))).toEqual({ cursor, size: 50 })
    expect(auditSearchFromParams(new URLSearchParams('cursor=bad%2Bcursor'))).toEqual({ size: 50 })
  })

  it('does not request or render audit data for an unauthorized membership', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'READ_ONLY' })
    render(<AuditTrail basePath="/firms/hearth/audit-trail" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only firm owners and managers')
    expect(mocks.useGetAuditTrailQuery).toHaveBeenCalledWith(expect.anything(), { skip: true })
  })
})
