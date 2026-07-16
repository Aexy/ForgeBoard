// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn() }
const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), board: vi.fn(), detail: vi.fn(), views: vi.fn(), move: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/store/api', () => ({ useGetWorkflowBoardQuery: mocks.board, useGetWorkItemDetailQuery: mocks.detail, useGetWorkflowViewsQuery: mocks.views, useMoveWorkItemMutation: () => [mocks.move, { isLoading: false }] }))

import { WorkflowBoard } from '@/features/workflow/WorkflowBoard'

const item = { id: 'task-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL', rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null, reviewerUserId: null, reviewerDisplayName: null }
const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE', position: 0, items: [item] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW', position: 1, items: [] }] }

describe('WorkflowBoard', () => {
  afterEach(cleanup)
  beforeEach(() => { router.push.mockReset(); mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.board.mockReturnValue({ data: board, isLoading: false, isError: false, refetch: vi.fn() }); mocks.detail.mockReturnValue({}); mocks.views.mockReturnValue({ data: [] }); mocks.move.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }) })
  it('opens query-backed detail on click and the full task route on double click', () => {
    render(<WorkflowBoard workflowId="flow-1" basePath="/firms/hearth/workflow/flow-1" />)
    const card = screen.getByRole('heading', { name: 'July close' }).closest('article')!
    fireEvent.click(card)
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/flow-1?task=task-1')
    fireEvent.doubleClick(card)
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/flow-1/tasks/task-1')
  })
  it('moves a card only through the confirmed mutation', async () => {
    render(<WorkflowBoard workflowId="flow-1" basePath="/firms/hearth/workflow/flow-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Move July close right' }))
    await vi.waitFor(() => expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), workflowId: 'flow-1', itemId: 'task-1', targetStageId: 'review', expectedVersion: 0 })))
  })
})
