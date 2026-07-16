import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkflowView } from './WorkflowView'
import * as clients from './api/clients'
import * as workflows from './api/workflows'
import * as activity from './api/activity'
import * as employees from './api/employees'
import { employeeDashboardKey } from './api/employeeDashboard'
import { LANGUAGE_STORAGE_KEY, LanguageProvider } from './i18n'

vi.mock('./api/clients', () => ({ listClients: vi.fn() }))
vi.mock('./api/workflows', () => ({ listWorkflows: vi.fn(), getWorkflow: vi.fn(), getWorkItemDetail: vi.fn(), createWorkflow: vi.fn(), createWorkItem: vi.fn(), moveWorkItem: vi.fn(), assignWorkItem: vi.fn(), assignWorkItemReviewer: vi.fn() }))
vi.mock('./api/activity', () => ({ listActivity: vi.fn() }))
vi.mock('./api/employees', () => ({ listEmployees: vi.fn() }))

function renderWorkflow(firmId = 'firm-1', role: 'OWNER' | 'MEMBER' = 'MEMBER') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(employeeDashboardKey(firmId), { today: '2026-07-16' })
  queryClient.setQueryData(employeeDashboardKey('firm-2'), { today: '2026-07-16' })
  return { queryClient, ...render(<LanguageProvider><QueryClientProvider client={queryClient}><WorkflowView firmId={firmId} role={role} /></QueryClientProvider></LanguageProvider>) }
}

describe('WorkflowView', () => {
  beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); window.history.replaceState(null, '', '/'); vi.mocked(clients.listClients).mockResolvedValue([{ id: 'client-1', legalName: 'Northstar GmbH', displayName: 'Northstar', primaryEmail: null, status: 'ACTIVE', version: 0 }]); vi.mocked(activity.listActivity).mockResolvedValue([{ actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.created', targetType: 'work_item', targetId: 'item-1', summary: { title: 'July close' }, occurredAt: '2026-07-12T12:00:00Z' }]) })

  it('clears an owner when Unassigned is selected', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0, ownerUserId: 'employee-1' }] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board)
    vi.mocked(workflows.assignWorkItem).mockResolvedValue({ ...board.stages[0].items[0], ownerUserId: null })
    vi.mocked(employees.listEmployees).mockResolvedValue([{ membershipId: 'membership-1', userId: 'employee-1', displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' }])

    const { queryClient } = renderWorkflow('firm-1', 'OWNER')
    fireEvent.change(await screen.findByRole('combobox', { name: 'Assign July close' }), { target: { value: '' } })

    await waitFor(() => expect(workflows.assignWorkItem).toHaveBeenCalledWith('firm-1', 'flow-1', 'item-1', null))
    await waitFor(() => expect(queryClient.getQueryState(employeeDashboardKey('firm-1'))?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(employeeDashboardKey('firm-2'))?.isInvalidated).toBe(false)
  })

  it('shows assignment details to a member without assignment controls', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [
      { id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0, ownerUserId: 'employee-1', ownerDisplayName: 'Mira Miller' },
      { id: 'item-2', clientId: 'client-1', stageId: 'todo', title: 'VAT review', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 2, version: 0, ownerUserId: null, ownerDisplayName: null },
    ] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }])
    vi.mocked(workflows.getWorkflow).mockResolvedValue(board)

    renderWorkflow()

    expect(await screen.findByText('Assigned: Mira Miller')).toBeInTheDocument()
    expect(screen.getByText('Assigned: Unassigned')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Assign/ })).not.toBeInTheDocument()
  })

  it('shows German assignment details to a member', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [
      { id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0, ownerUserId: 'employee-1', ownerDisplayName: 'Mira Miller' },
      { id: 'item-2', clientId: 'client-1', stageId: 'todo', title: 'VAT review', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 2, version: 0, ownerUserId: null, ownerDisplayName: null },
    ] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }])
    vi.mocked(workflows.getWorkflow).mockResolvedValue(board)

    renderWorkflow()

    expect(await screen.findByText('Zugewiesen: Mira Miller')).toBeInTheDocument()
    expect(screen.getByText('Zugewiesen: Nicht zugewiesen')).toBeInTheDocument()
  })

  it('does not show the previous firm board while the next board is loading', async () => {
    const firstBoard = { id: 'flow-1', name: 'Firm one close', stages: [] }
    const secondBoard = { id: 'flow-2', name: 'Firm two close', stages: [] }
    let resolveSecondWorkflows!: (value: Array<{ id: string; name: string }>) => void
    vi.mocked(workflows.listWorkflows)
      .mockResolvedValueOnce([{ id: 'flow-1', name: 'Firm one close' }])
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondWorkflows = resolve }))
    vi.mocked(workflows.getWorkflow).mockResolvedValueOnce(firstBoard).mockResolvedValueOnce(secondBoard)
    vi.mocked(employees.listEmployees).mockResolvedValue([])

    const { rerender } = renderWorkflow('firm-1', 'OWNER')
    expect(await screen.findByRole('heading', { name: 'Firm one close' })).toBeInTheDocument()

    rerender(<LanguageProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WorkflowView firmId="firm-2" role="OWNER" /></QueryClientProvider></LanguageProvider>)
    expect(screen.queryByRole('heading', { name: 'Firm one close' })).not.toBeInTheDocument()
    expect(screen.getByText(/^Loading workflow/)).toBeInTheDocument()

    resolveSecondWorkflows([{ id: 'flow-2', name: 'Firm two close' }])
    expect(await screen.findByRole('heading', { name: 'Firm two close' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Firm one close' })).not.toBeInTheDocument()
  })

  it('creates a workflow with explicitly configured stage attention', async () => {
    vi.mocked(workflows.listWorkflows).mockResolvedValue([])
    vi.mocked(workflows.createWorkflow).mockResolvedValue({ id: 'flow-1', name: 'Monthly close', stages: [] })
    renderWorkflow()

    fireEvent.click(await screen.findByRole('button', { name: '+ New workflow' }))
    fireEvent.change(screen.getByLabelText('Workflow name'), { target: { value: 'Monthly close' } })
    fireEvent.change(screen.getByLabelText('Stage 2 attention'), { target: { value: 'BLOCKED' } })
    fireEvent.change(screen.getByLabelText('Stage 3 attention'), { target: { value: 'AWAITING_REVIEW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create workflow' }))

    await waitFor(() => expect(workflows.createWorkflow).toHaveBeenCalledWith('firm-1', {
      name: 'Monthly close',
      stages: [
        { name: 'Waiting on client', attention: 'NONE' },
        { name: 'In preparation', attention: 'BLOCKED' },
        { name: 'Ready for review', attention: 'AWAITING_REVIEW' },
        { name: 'Complete', attention: 'NONE' },
      ],
    }))
  })

  it('loads a board and moves a card with accessible controls', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0 }] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW' as const, position: 1, items: [] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board); vi.mocked(workflows.moveWorkItem).mockResolvedValue({ ...board.stages[0].items[0], stageId: 'review' })
    const { queryClient } = renderWorkflow()
    expect(await screen.findByText('Work item created')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Move July close right' }))
    await waitFor(() => expect(workflows.moveWorkItem).toHaveBeenCalledWith('firm-1', 'flow-1', 'item-1', 'review', 0))
    await waitFor(() => expect(activity.listActivity).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(queryClient.getQueryState(employeeDashboardKey('firm-1'))?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(employeeDashboardKey('firm-2'))?.isInvalidated).toBe(false)
  })

  it('moves a dragged card into a dropped stage', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0 }] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW' as const, position: 1, items: [] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board); vi.mocked(workflows.moveWorkItem).mockResolvedValue({ ...board.stages[0].items[0], stageId: 'review' })
    renderWorkflow()
    const card = (await screen.findByRole('heading', { name: 'July close' })).closest('article')!
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn() } })
    fireEvent.drop(screen.getByLabelText('Review stage'), { dataTransfer: { getData: () => 'item-1' } })
    await waitFor(() => expect(workflows.moveWorkItem).toHaveBeenCalledWith('firm-1', 'flow-1', 'item-1', 'review', 0))
  })

  it('refreshes the board and explains a concurrent-move conflict', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0 }] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW' as const, position: 1, items: [] }] }
    const refreshed = { ...board, stages: [{ ...board.stages[0], items: [] }, { ...board.stages[1], items: [{ ...board.stages[0].items[0], stageId: 'review', version: 1 }] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValueOnce(board).mockResolvedValueOnce(refreshed); vi.mocked(workflows.moveWorkItem).mockRejectedValue(new Error('ForgeBoard request failed with 409'))
    renderWorkflow()
    fireEvent.click(await screen.findByRole('button', { name: 'Move July close right' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This work item was changed by another user')
    expect(workflows.getWorkflow).toHaveBeenCalledTimes(2)
  })

  it('renders readable activity summaries without exposing internal ids', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo-id', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [] }, { id: 'review-id', name: 'Review', attention: 'AWAITING_REVIEW' as const, position: 1, items: [] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board)
    vi.mocked(activity.listActivity).mockResolvedValue([
      { actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.created', targetType: 'work_item', targetId: 'item-id', summary: { title: 'July close', workflowId: 'flow-1' }, occurredAt: '2026-07-12T12:00:00Z' },
      { actorUserId: 'user-1', actorType: 'USER', source: 'WEB', action: 'work-item.moved', targetType: 'work_item', targetId: 'item-id', summary: { fromStageId: 'todo-id', toStageId: 'review-id' }, occurredAt: '2026-07-12T12:01:00Z' }
    ])
    renderWorkflow()
    expect(await screen.findByText('July close')).toBeInTheDocument()
    expect(await screen.findByText('Preparation to Review')).toBeInTheDocument()
    expect(screen.queryByText(/flow-1|todo-id|review-id/)).not.toBeInTheDocument()
  })

  it('filters visible cards and restores selected filters from the workflow URL', async () => {
    window.history.replaceState(null, '', '/?workflow=flow-1&priority=URGENT&unassigned=true')
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'BLOCKED' as const, position: 0, items: [
      { id: 'urgent', clientId: 'client-1', stageId: 'todo', title: 'Urgent close', description: '', dueDate: '2026-07-15', priority: 'URGENT' as const, rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null },
      { id: 'normal', clientId: 'client-1', stageId: 'todo', title: 'Assigned close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 2, version: 0, ownerUserId: 'employee-1', ownerDisplayName: 'Mira Miller' },
    ] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board)

    renderWorkflow()

    expect(await screen.findByRole('heading', { name: 'Urgent close' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Assigned close' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Filter by priority')).toHaveValue('URGENT')
    expect(screen.getByLabelText('Show unassigned work')).toBeChecked()
    expect(screen.getByLabelText('Blocked')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(await screen.findByRole('heading', { name: 'Assigned close' })).toBeInTheDocument()
    expect(window.location.search).not.toContain('priority=')
  })

  it('shows due state and priority on a visible task card', async () => {
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [{ id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: '2026-07-15', priority: 'HIGH' as const, rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null }] }] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board)
    renderWorkflow()
    const card = (await screen.findByRole('heading', { name: 'July close' })).closest('article')!
    expect(card).toHaveTextContent('Due 2026-07-15')
    expect(card).toHaveTextContent('high')
    expect(card).toHaveTextContent('Assigned: Unassigned')
  })

  it('opens task details beside the board and a named workspace with Back navigation', async () => {
    const item = { id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: 'Reconcile bank entries.', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null, reviewerUserId: null, reviewerDisplayName: null }
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [item] }] }
    const detail = { item, clientDisplayName: 'Northstar', documentRequests: [], activity: [] }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board); vi.mocked(workflows.getWorkItemDetail).mockResolvedValue(detail)
    renderWorkflow()

    fireEvent.click(await screen.findByRole('heading', { name: 'July close' }))
    expect(await screen.findByRole('complementary', { name: 'July close details' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open task workspace' }))
    expect(await screen.findByRole('heading', { name: 'July close' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to workflow' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to workflow' }))
    expect(await screen.findByRole('heading', { name: 'Monthly close' })).toBeInTheDocument()
  })

  it('warns when an owner is selected as the reviewer and confirms it on the board', async () => {
    const item = { id: 'item-1', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL' as const, rank: 1, version: 0, ownerUserId: 'employee-1', ownerDisplayName: 'Mira Miller', reviewerUserId: null, reviewerDisplayName: null }
    const board = { id: 'flow-1', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE' as const, position: 0, items: [item] }] }
    const detail = { item, clientDisplayName: 'Northstar', documentRequests: [], activity: [] }
    const updated = { ...item, reviewerUserId: 'employee-1', reviewerDisplayName: 'Mira Miller' }
    vi.mocked(workflows.listWorkflows).mockResolvedValue([{ id: 'flow-1', name: 'Monthly close' }]); vi.mocked(workflows.getWorkflow).mockResolvedValue(board); vi.mocked(workflows.getWorkItemDetail).mockResolvedValue(detail); vi.mocked(workflows.assignWorkItemReviewer).mockResolvedValue(updated)
    vi.mocked(employees.listEmployees).mockResolvedValue([{ membershipId: 'membership-1', userId: 'employee-1', displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' }])
    renderWorkflow('firm-1', 'OWNER')

    fireEvent.click(await screen.findByRole('button', { name: 'Open July close task workspace' }))
    await screen.findByRole('combobox', { name: 'Select reviewer' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Select reviewer' }), { target: { value: 'employee-1' } })
    expect(await screen.findByText('The owner is also the reviewer. This is allowed, but a separate reviewer is recommended.')).toBeInTheDocument()
  })
})
