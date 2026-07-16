import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { AuditTrailView } from './AuditTrailView'

vi.mock('./api/activity', () => ({ listAuditTrail: vi.fn() }))
import { listAuditTrail } from './api/activity'

describe('AuditTrailView', () => {
  it('clears prior firm activity while the next firm loads', async () => {
    vi.mocked(listAuditTrail).mockResolvedValueOnce({ items: [{ actorUserId: 'user', actorType: 'USER', source: 'WEB', action: 'work-item.moved', targetType: 'work-item', targetId: 'old', summary: { title: 'Old firm task' }, occurredAt: '2026-07-16T10:00:00Z' }], nextCursor: null })
    const { rerender } = render(<AuditTrailView firmId="firm-1" />)
    expect(await screen.findByText('Old firm task')).toBeInTheDocument()
    let resolveNext!: (value: { items: []; nextCursor: null }) => void
    vi.mocked(listAuditTrail).mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve }))
    rerender(<AuditTrailView firmId="firm-2" />)
    expect(screen.queryByText('Old firm task')).not.toBeInTheDocument()
    expect(screen.getByText('Loading audit activity…')).toBeInTheDocument()
    resolveNext({ items: [], nextCursor: null })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No activity found' })).toBeInTheDocument())
  })
})
