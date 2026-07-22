// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() }
const mocks = vi.hoisted(() => ({ firm: vi.fn(), detail: vi.fn(), board: vi.fn(), employees: vi.fn(), updateReviewer: vi.fn(), documents: vi.fn(), link: vi.fn(), unlink: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkItemDetailQuery: mocks.detail, useGetWorkflowBoardQuery: mocks.board, useUpdateWorkItemReviewerMutation: () => [mocks.updateReviewer, { isLoading: false }], useGetDocumentRequestsQuery: mocks.documents, useLinkDocumentRequestMutation: () => [mocks.link, { isLoading: false }], useUnlinkDocumentRequestMutation: () => [mocks.unlink, { isLoading: false }] }))
vi.mock('@/features/employees/employees-transport', () => ({ useGetEmployeesQuery: mocks.employees }))

import { TaskWorkspace } from '@/features/workflow/TaskWorkspace'
import { LanguageProvider } from '@/app/LanguageProvider'

const render = (ui: ReactElement) => baseRender(<LanguageProvider initialLanguage="en">{ui}</LanguageProvider>)

const item = { id: 'internal-task-id', taskReference: 'FB-1042', clientId: 'client-1', stageId: 'todo', title: 'July close', description: 'Reconcile bank statements.', dueDate: '2026-07-31', priority: 'NORMAL', rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null, reviewerUserId: null, reviewerDisplayName: null }

describe('TaskWorkspace', () => {
  afterEach(cleanup)
  beforeEach(() => {
    router.push.mockReset(); router.replace.mockReset(); mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.detail.mockReturnValue({ data: { item, clientDisplayName: 'Hearth Bakery', documentRequests: [], activity: [{ action: 'work-item.created', occurredAt: '2026-07-17T10:00:00Z' }] }, isLoading: false, isError: false }); mocks.board.mockReturnValue({ data: { id: 'internal-workflow-id' }, isLoading: false }); mocks.employees.mockReturnValue({ data: [{ userId: 'reviewer-1', displayName: 'Taylor Reviewer' }] }); mocks.documents.mockReturnValue({ data: [{ id: 'matching', clientId: 'client-1', label: 'Bank statement', status: 'REQUESTED' }, { id: 'other-client', clientId: 'other-client', label: 'Other client document', status: 'REQUESTED' }] }); mocks.updateReviewer.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }); mocks.link.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }); mocks.unlink.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) })
  })

  it('returns to the canonical board path and shows activity timestamps', () => {
    render(<TaskWorkspace workflowSlug="monthly-close" taskReference="FB-1042" workflowPath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to workflow' }))
    expect(router.replace).toHaveBeenCalledWith('/firms/hearth/workflow/monthly-close')
    expect(document.querySelector('time[datetime="2026-07-17T10:00:00Z"]')).toBeInTheDocument()
  })

  it('shows a live error when reviewer assignment fails', async () => {
    mocks.updateReviewer.mockReturnValue({ unwrap: vi.fn().mockRejectedValue(new Error('forbidden')) })
    render(<TaskWorkspace workflowSlug="monthly-close" taskReference="FB-1042" workflowPath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.change(screen.getByLabelText('Select reviewer'), { target: { value: 'reviewer-1' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('The reviewer could not be updated.')
  })
  it('shows only unlinked matching document requests and links them from the workspace', async () => {
    render(<TaskWorkspace workflowSlug="monthly-close" taskReference="FB-1042" workflowPath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.getByText('Bank statement')).toBeInTheDocument()
    expect(screen.queryByText('Other client document')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Link Bank statement' }))
    await vi.waitFor(() => expect(mocks.link).toHaveBeenCalledWith({ firm: expect.any(Object), workflowId: 'internal-workflow-id', itemId: 'internal-task-id', requestId: 'matching' }))
  })
  it('hides document controls from managers', () => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' })
    render(<TaskWorkspace workflowSlug="monthly-close" taskReference="FB-1042" workflowPath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.queryByRole('button', { name: 'Link Bank statement' })).not.toBeInTheDocument()
  })
})
