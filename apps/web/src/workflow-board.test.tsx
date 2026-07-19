// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn() }
const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), board: vi.fn(), detail: vi.fn(), views: vi.fn(), move: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkflowBoardQuery: mocks.board, useGetWorkItemDetailQuery: mocks.detail, useGetWorkflowViewsQuery: mocks.views, useMoveWorkItemMutation: () => [mocks.move, { isLoading: false }] }))

import { WorkflowBoard } from '@/features/workflow/WorkflowBoard'
import { TaskPanel } from '@/features/workflow/TaskPanel'
import type { WorkItemDetail } from '@/features/workflow/workflow-transport'

const item = { id: 'task-1', taskReference: 'FB-1042', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL', rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null, reviewerUserId: null, reviewerDisplayName: null }
const board = { id: 'flow-1', workflowSlug: 'monthly-close', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE', position: 0, items: [item] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW', position: 1, items: [] }] }
const detail: WorkItemDetail = { item: { ...item, priority: 'NORMAL' }, clientDisplayName: 'Hearth Bakery', documentRequests: [], activity: [] }

describe('WorkflowBoard', () => {
  afterEach(cleanup)
  beforeEach(() => { router.push.mockReset(); mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.board.mockReturnValue({ data: board, isLoading: false, isError: false, refetch: vi.fn() }); mocks.detail.mockReturnValue({}); mocks.views.mockReturnValue({ data: [] }); mocks.move.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }) })
  it('opens query-backed detail on click and the full task route on double click', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const card = screen.getByRole('button', { name: 'Open July close details' })
    fireEvent.click(card)
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close?task=FB-1042')
    fireEvent.doubleClick(card)
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close/tasks/FB-1042')
  })
  it('uses one native activation control for a card', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const card = screen.getByRole('button', { name: 'Open July close details' })
    fireEvent.click(card)
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close?task=FB-1042')
    expect(router.push).toHaveBeenCalledTimes(1)
  })
  it('moves a card only through the confirmed mutation', async () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Move July close right' }))
    await vi.waitFor(() => expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), workflowId: 'flow-1', itemId: 'task-1', targetStageId: 'review', expectedVersion: 0 })))
  })
  it('displays a public task reference without rendering the internal id', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.getByText('FB-1042')).toBeInTheDocument()
    expect(screen.queryByText('task-1')).not.toBeInTheDocument()
  })
  it('closes a panel to the filter-preserving public board URL', () => {
    render(<TaskPanel detail={detail} boardPath="/firms/hearth/workflow/monthly-close?priority=URGENT" taskPath="/firms/hearth/workflow/monthly-close/tasks/FB-1042" />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(router.replace).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close?priority=URGENT')
  })
  it('presents task detail as an accessible complementary panel and closes it with Escape', () => {
    render(<TaskPanel detail={detail} boardPath="/firms/hearth/workflow/monthly-close" taskPath="/firms/hearth/workflow/monthly-close/tasks/FB-1042" />)
    expect(screen.getByRole('complementary', { name: 'July close details' })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(router.replace).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close')
  })
})
