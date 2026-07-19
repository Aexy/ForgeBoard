// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn() }
const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), board: vi.fn(), detail: vi.fn(), views: vi.fn(), move: vi.fn(), create: vi.fn(), createWorkflow: vi.fn(), updateOwner: vi.fn(), updateReviewer: vi.fn(), refetch: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkflowBoardQuery: mocks.board, useGetWorkItemDetailQuery: mocks.detail, useGetWorkflowViewsQuery: mocks.views, useMoveWorkItemMutation: () => [mocks.move, { isLoading: false }], useCreateWorkItemMutation: () => [mocks.create, { isLoading: false }], useCreateWorkflowMutation: () => [mocks.createWorkflow, { isLoading: false }], useUpdateWorkItemOwnerMutation: () => [mocks.updateOwner, { isLoading: false }], useUpdateWorkItemReviewerMutation: () => [mocks.updateReviewer, { isLoading: false }] }))
vi.mock('@/features/clients/clients-transport', () => ({ useGetClientsQuery: () => ({ data: [{ id: 'client-1', displayName: 'Hearth Bakery', status: 'ACTIVE' }] }) }))

import { WorkflowBoard } from '@/features/workflow/WorkflowBoard'
import { TaskPanel } from '@/features/workflow/TaskPanel'
import type { WorkItemDetail } from '@/features/workflow/workflow-transport'

const item = { id: 'task-1', taskReference: 'FB-1042', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL', rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null, reviewerUserId: null, reviewerDisplayName: null }
const board = { id: 'flow-1', workflowSlug: 'monthly-close', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE', position: 0, items: [item] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW', position: 1, items: [] }] }
const detail: WorkItemDetail = { item: { ...item, priority: 'NORMAL' }, clientDisplayName: 'Hearth Bakery', documentRequests: [], activity: [] }

describe('WorkflowBoard', () => {
  afterEach(cleanup)
  beforeEach(() => { router.push.mockReset(); mocks.refetch.mockReset(); mocks.refetch.mockResolvedValue(undefined); mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.board.mockReturnValue({ data: board, isLoading: false, isError: false, refetch: mocks.refetch }); mocks.detail.mockReturnValue({}); mocks.views.mockReturnValue({ data: [] }); mocks.move.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }); mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }); mocks.createWorkflow.mockReset(); mocks.updateOwner.mockReturnValue({ unwrap: vi.fn() }); mocks.updateReviewer.mockReturnValue({ unwrap: vi.fn() }) })
  it('lets a manager create an additional workflow from a populated board', async () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' })
    mocks.createWorkflow.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'workflow-2', workflowSlug: 'monthly-close' }) })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'New workflow' }))
    fireEvent.change(screen.getByLabelText('Workflow name'), { target: { value: 'Monthly close' } })
    fireEvent.submit(screen.getByRole('heading', { name: 'New workflow' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.createWorkflow).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), details: { name: 'Monthly close', stages: [{ name: 'Waiting on client', attention: 'NONE' }, { name: 'In preparation', attention: 'NONE' }, { name: 'Ready for review', attention: 'AWAITING_REVIEW' }, { name: 'Complete', attention: 'NONE' }] } }))
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close')
  })
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
  it('refetches only after a 409 move conflict and keeps the retry message', async () => {
    mocks.move.mockReturnValue({ unwrap: vi.fn().mockRejectedValue({ status: 409 }) })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Move July close right' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This work item was changed by another user. The board was refreshed; retry your move.')
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })
  it('creates a work item inline in its selected stage', async () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add work item to Preparation' }))
    fireEvent.change(screen.getByRole('form', { name: 'New work item' }).querySelector('select[name="clientId"]')!, { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bank reconciliation' } })
    fireEvent.submit(screen.getByRole('form', { name: 'New work item' }))
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ workflowId: 'flow-1', details: expect.objectContaining({ stageId: 'todo', clientId: 'client-1', title: 'Bank reconciliation' }) })))
    expect(await screen.findByRole('alert')).toHaveTextContent('Work item created.')
    expect(screen.queryByRole('form', { name: 'New work item' })).not.toBeInTheDocument()
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
