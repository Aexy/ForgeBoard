import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkflowView } from './WorkflowView'
import * as clients from './api/clients'
import * as workflows from './api/workflows'
import * as activity from './api/activity'

vi.mock('./api/clients', () => ({ listClients: vi.fn() }))
vi.mock('./api/workflows', () => ({ listWorkflows: vi.fn(), getWorkflow: vi.fn(), createWorkflow: vi.fn(), createWorkItem: vi.fn(), moveWorkItem: vi.fn() }))
vi.mock('./api/activity', () => ({ listActivity: vi.fn() }))

describe('WorkflowView', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(clients.listClients).mockResolvedValue([{ id: 'client-1', legalName: 'Northstar GmbH', displayName: 'Northstar', primaryEmail: null, status: 'ACTIVE', version: 0 }]); vi.mocked(activity.listActivity).mockResolvedValue([{ actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.created', targetType: 'work_item', targetId: 'item-1', summary: { title: 'July close' }, occurredAt: '2026-07-12T12:00:00Z' }]) })

  it('loads a board and moves a card with accessible controls', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0 }] }, { id: 'review', name: 'Review', position: 1, items: [] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board); vi.mocked(workflows.moveWorkItem).mockResolvedValue({ ...board.stages[0].items[0], stageId: 'review' })
    render(<WorkflowView firmId="firm-1" />)
    expect(await screen.findByText('Work item created')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Move July close right' }))
    await waitFor(() => expect(workflows.moveWorkItem).toHaveBeenCalledWith('firm-1', 'flow-1', 'item-1', 'review'))
    await waitFor(() => expect(activity.listActivity).toHaveBeenCalledTimes(2))
  })

  it('moves a dragged card into a dropped stage', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0 }] }, { id: 'review', name: 'Review', position: 1, items: [] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board); vi.mocked(workflows.moveWorkItem).mockResolvedValue({ ...board.stages[0].items[0], stageId: 'review' })
    render(<WorkflowView firmId="firm-1" />)
    const card = (await screen.findByRole('heading', { name: 'July close' })).closest('article')!
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn() } })
    fireEvent.drop(screen.getByLabelText('Review stage'), { dataTransfer: { getData: () => 'item-1' } })
    await waitFor(() => expect(workflows.moveWorkItem).toHaveBeenCalledWith('firm-1', 'flow-1', 'item-1', 'review'))
  })

  it('renders readable activity summaries without exposing internal ids', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo-id', name: 'Preparation', position: 0, items: [] }, { id: 'review-id', name: 'Review', position: 1, items: [] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board)
    vi.mocked(activity.listActivity).mockResolvedValue([
      { actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.created', targetType: 'work_item', targetId: 'item-id', summary: { title: 'July close', workflowId: 'flow-1' }, occurredAt: '2026-07-12T12:00:00Z' },
      { actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.moved', targetType: 'work_item', targetId: 'item-id', summary: { fromStageId: 'todo-id', toStageId: 'review-id' }, occurredAt: '2026-07-12T12:01:00Z' }
    ])
    render(<WorkflowView firmId="firm-1" />)
    expect(await screen.findByText('July close')).toBeInTheDocument()
    expect(await screen.findByText('Preparation to Review')).toBeInTheDocument()
    expect(screen.queryByText(/flow-1|todo-id|review-id/)).not.toBeInTheDocument()
  })
})
