// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firm: vi.fn(), query: vi.fn(), toggle: vi.fn() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('./engagements-transport', () => ({ useGetEngagementChecklistQuery: mocks.query, useToggleEngagementChecklistItemMutation: () => [mocks.toggle, { isLoading: false }] }))

import { EngagementChecklist } from './EngagementChecklist'

describe('EngagementChecklist', () => {
  afterEach(cleanup)
  beforeEach(() => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MEMBER' })
    mocks.query.mockReturnValue({ data: [{ id: 'check-1', label: 'Reconcile bank account', required: true, position: 0, completed: false, completedAt: null, completedBy: null, canUpdate: false, version: 3 }], isLoading: false, isError: false, refetch: vi.fn().mockResolvedValue({}) })
    mocks.toggle.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) })
  })

  it('shows checklist progress and only lets the assigned preparer update an item', () => {
    const view = render(<EngagementChecklist engagementId="engagement-1" />)
    const checkbox = screen.getByRole('checkbox', { name: /reconcile bank account/i })
    expect(screen.getByText('0 of 1 complete')).toBeVisible()
    expect(checkbox).toBeDisabled()
    expect(screen.getByText(/only the assigned preparer/i)).toBeVisible()
    mocks.query.mockReturnValue({ data: [{ id: 'check-1', label: 'Reconcile bank account', required: true, position: 0, completed: false, completedAt: null, completedBy: null, canUpdate: true, version: 3 }], isLoading: false, isError: false, refetch: vi.fn().mockResolvedValue({}) })
    view.rerender(<EngagementChecklist engagementId="engagement-1" />)
    fireEvent.click(checkbox)
    expect(mocks.toggle).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), engagementId: 'engagement-1', checklistItemId: 'check-1', completed: true, expectedVersion: 3 })
  })

  it('restores the latest data and explains a rejected update', async () => {
    const refetch = vi.fn().mockResolvedValue({})
    mocks.query.mockReturnValue({ data: [{ id: 'check-1', label: 'Reconcile bank account', required: true, position: 0, completed: false, completedAt: null, completedBy: null, canUpdate: true, version: 3 }], isLoading: false, isError: false, refetch })
    mocks.toggle.mockReturnValue({ unwrap: vi.fn().mockRejectedValue(new Error('stale')) })
    render(<EngagementChecklist engagementId="engagement-1" />)
    fireEvent.click(screen.getByRole('checkbox', { name: /reconcile bank account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('latest status has been restored')
    expect(refetch).toHaveBeenCalled()
  })
})
