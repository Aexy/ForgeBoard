// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render as baseRender, screen, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import type { CollisionDetection, KeyboardCoordinateGetter } from '@dnd-kit/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn() }
const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), searchParams: vi.fn(), board: vi.fn(), detail: vi.fn(), views: vi.fn(), workflows: vi.fn(), move: vi.fn(), create: vi.fn(), createWorkflow: vi.fn(), updateOwner: vi.fn(), updateReviewer: vi.fn(), refetch: vi.fn(), isSaving: false }))
const dnd = vi.hoisted(() => ({
  contextProps: null as (Record<string, unknown> & { children?: ReactNode }) | null,
  droppableIds: [] as string[],
  overStageId: null as string | null,
  draggingId: null as string | null,
  PointerSensor: class PointerSensor {},
  TouchSensor: class TouchSensor {},
  KeyboardSensor: class KeyboardSensor {},
  closestCorners: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: mocks.searchParams }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: Record<string, unknown> & { children?: ReactNode }) => { dnd.contextProps = props; return props.children },
  DragOverlay: ({ children }: Readonly<{ children?: ReactNode }>) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: dnd.PointerSensor,
  TouchSensor: dnd.TouchSensor,
  KeyboardSensor: dnd.KeyboardSensor,
  closestCorners: dnd.closestCorners,
  useSensor: (sensor: unknown, options: unknown) => ({ sensor, options }),
  useSensors: (...sensors: unknown[]) => sensors,
  useDroppable: ({ id }: Readonly<{ id: string }>) => {
    dnd.droppableIds.push(id)
    return { isOver: dnd.overStageId === id, setNodeRef: vi.fn() }
  },
  useDraggable: ({ id }: Readonly<{ id: string }>) => ({
    attributes: { 'aria-describedby': `dnd-description-${id}` },
    isDragging: dnd.draggingId === id,
    listeners: {},
    setActivatorNodeRef: vi.fn(),
    setNodeRef: vi.fn(),
    transform: null,
  }),
}))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkflowBoardQuery: mocks.board, useGetWorkItemDetailQuery: mocks.detail, useGetWorkflowViewsQuery: mocks.views, useGetWorkflowsQuery: mocks.workflows, useMoveWorkItemMutation: () => [mocks.move, { isLoading: mocks.isSaving }], useCreateWorkItemMutation: () => [mocks.create, { isLoading: false }], useCreateWorkflowMutation: () => [mocks.createWorkflow, { isLoading: false }], useUpdateWorkItemOwnerMutation: () => [mocks.updateOwner, { isLoading: false }], useUpdateWorkItemReviewerMutation: () => [mocks.updateReviewer, { isLoading: false }] }))
vi.mock('@/features/clients/clients-transport', () => ({ useGetClientsQuery: () => ({ data: [{ id: 'client-1', displayName: 'Hearth Bakery', status: 'ACTIVE' }] }) }))

import { WorkflowBoard } from '@/features/workflow/WorkflowBoard'
import { TaskPanel } from '@/features/workflow/TaskPanel'
import createWorkflowStyles from '@/features/workflow/CreateWorkflowForm.module.css'
import type { WorkItemDetail } from '@/features/workflow/workflow-transport'
import { LanguageProvider } from '@/app/LanguageProvider'

const render = (ui: ReactElement) => baseRender(<LanguageProvider initialLanguage="en">{ui}</LanguageProvider>)

const item = { id: 'task-1', taskReference: 'FB-1042', clientId: 'client-1', stageId: 'todo', title: 'July close', description: '', dueDate: null, priority: 'NORMAL', rank: 1, version: 0, ownerUserId: null, ownerDisplayName: null, reviewerUserId: null, reviewerDisplayName: null }
const board = { id: 'flow-1', workflowSlug: 'monthly-close', name: 'Monthly close', stages: [{ id: 'todo', name: 'Preparation', attention: 'NONE', position: 0, items: [item] }, { id: 'review', name: 'Review', attention: 'AWAITING_REVIEW', position: 1, items: [] }] }
const detail: WorkItemDetail = { item: { ...item, priority: 'NORMAL' }, clientDisplayName: 'Hearth Bakery', documentRequests: [], activity: [] }

type DndHarness = {
  accessibility: {
    announcements: {
      onDragStart: (event: unknown) => string | undefined
      onDragOver: (event: unknown) => string | undefined
      onDragEnd: (event: unknown) => string | undefined
      onDragCancel: (event: unknown) => string | undefined
    }
  }
  onDragStart: (event: unknown) => void
  onDragEnd: (event: unknown) => Promise<void>
  onDragCancel: (event: unknown) => void
  collisionDetection: CollisionDetection
  sensors: Array<{ sensor: unknown; options: Record<string, unknown> }>
}

function dndHarness() {
  return dnd.contextProps as unknown as DndHarness
}

describe('WorkflowBoard', () => {
  afterEach(cleanup)
  beforeEach(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }); router.push.mockReset(); mocks.isSaving = false; dnd.contextProps = null; dnd.droppableIds.length = 0; dnd.overStageId = null; dnd.draggingId = null; dnd.closestCorners.mockReset(); mocks.refetch.mockReset(); mocks.refetch.mockResolvedValue(undefined); mocks.searchParams.mockReturnValue(new URLSearchParams()); mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.board.mockReturnValue({ data: board, isLoading: false, isError: false, refetch: mocks.refetch }); mocks.detail.mockReturnValue({}); mocks.views.mockReturnValue({ data: [] }); mocks.workflows.mockReturnValue({ data: [{ id: 'flow-1', name: 'Monthly close', workflowSlug: 'monthly-close' }, { id: 'flow-2', name: 'Quarterly close', workflowSlug: 'quarterly-close' }] }); mocks.move.mockReset(); mocks.move.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }); mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(item) }); mocks.createWorkflow.mockReset(); mocks.updateOwner.mockReturnValue({ unwrap: vi.fn() }); mocks.updateReviewer.mockReturnValue({ unwrap: vi.fn() }) })
  it('lets a manager create an additional workflow from a populated board', async () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' })
    mocks.createWorkflow.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'workflow-2', workflowSlug: 'monthly-close' }) })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'New workflow' }))
    expect(screen.getByRole('heading', { name: 'New workflow' }).closest('form')).toHaveClass(createWorkflowStyles.formEntering)
    fireEvent.change(screen.getByLabelText('Workflow name'), { target: { value: 'Monthly close' } })
    fireEvent.submit(screen.getByRole('heading', { name: 'New workflow' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.createWorkflow).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), details: { name: 'Monthly close', stages: [{ name: 'Waiting on client', attention: 'NONE' }, { name: 'In preparation', attention: 'NONE' }, { name: 'Ready for review', attention: 'AWAITING_REVIEW' }, { name: 'Complete', attention: 'NONE' }] } }))
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/monthly-close')
  })
  it('switches workflow from the filter controls while preserving filters', () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams('priority=URGENT&task=FB-1042'))
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Workflow' }), { target: { value: 'quarterly-close' } })
    expect(router.push).toHaveBeenLastCalledWith('/firms/hearth/workflow/quarterly-close?priority=URGENT')
  })
  it('uses independently collapsible vertical stages on mobile', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const reviewItem = { ...item, id: 'task-2', taskReference: 'FB-1043', stageId: 'review', title: 'Review close' }
    mocks.board.mockReturnValue({ data: { ...board, stages: [{ ...board.stages[0] }, { ...board.stages[1], items: [reviewItem] }] }, isLoading: false, isError: false, refetch: mocks.refetch })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const preparation = await screen.findByRole('button', { name: 'Toggle stage Preparation' })
    const review = screen.getByRole('button', { name: 'Toggle stage Review' })
    expect(preparation).toHaveAttribute('aria-expanded', 'true')
    expect(review).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Open Review close details' })).not.toBeInTheDocument()
    fireEvent.click(review)
    expect(review).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Open Review close details' })).toBeVisible()
    const reviewContent = document.getElementById(review.getAttribute('aria-controls')!)
    expect(reviewContent).toHaveAttribute('data-state', 'opening')
    fireEvent.transitionEnd(reviewContent!)
    expect(reviewContent).toHaveAttribute('data-state', 'open')

    fireEvent.click(review)
    expect(review).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Open Review close details' })).toBeVisible()
    expect(reviewContent).toHaveAttribute('data-state', 'closing')
    fireEvent.transitionEnd(reviewContent!)
    expect(screen.queryByRole('button', { name: 'Open Review close details' })).not.toBeInTheDocument()
    expect(reviewContent).toHaveAttribute('data-state', 'closed')
  })
  it('starts the first stage expanded when a mobile board has no items', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    mocks.board.mockReturnValue({ data: { ...board, stages: board.stages.map((stage) => ({ ...stage, items: [] })) }, isLoading: false, isError: false, refetch: mocks.refetch })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(await screen.findByRole('button', { name: 'Toggle stage Preparation' })).toHaveAttribute('aria-expanded', 'true')
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
    expect(screen.getByRole('button', { name: 'Move FB-1042: July close' })).toHaveAttribute('aria-describedby')
  })
  it('reserves the drag handle for members who can move work items', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.getByRole('button', { name: 'Move FB-1042: July close' })).toBeVisible()

    cleanup()
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'READ_ONLY' })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.queryByRole('button', { name: 'Move FB-1042: July close' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move right July close' })).toBeEnabled()
  })
  it('persists exactly one cross-stage drag and ignores same-stage and outside drops', async () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const dragEnd = dndHarness().onDragEnd

    await act(async () => { await dragEnd({ active: { data: { current: { item } } }, over: { id: 'review' } }) })
    await vi.waitFor(() => expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ targetStageId: 'review' })))

    await act(async () => { await dragEnd({ active: { data: { current: { item } } }, over: { id: 'todo' } }) })
    await act(async () => { await dragEnd({ active: { data: { current: { item } } }, over: null }) })
    expect(mocks.move).toHaveBeenCalledTimes(1)
  })
  it('prevents drag movement while saving and for read-only members', async () => {
    mocks.isSaving = true
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.queryByRole('button', { name: 'Move FB-1042: July close' })).not.toBeInTheDocument()
    await act(async () => { await dndHarness().onDragEnd({ active: { data: { current: { item } } }, over: { id: 'review' } }) })
    expect(mocks.move).not.toHaveBeenCalled()

    cleanup()
    mocks.isSaving = false
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'READ_ONLY' })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.queryByRole('button', { name: 'Move FB-1042: July close' })).not.toBeInTheDocument()
    await act(async () => { await dndHarness().onDragEnd({ active: { data: { current: { item } } }, over: { id: 'review' } }) })
    expect(mocks.move).not.toHaveBeenCalled()
  })
  it('configures pointer, touch, and stage-aware keyboard sensors', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const sensors = dndHarness().sensors
    expect(sensors[0]).toEqual({ sensor: dnd.PointerSensor, options: { activationConstraint: { distance: 6 } } })
    expect(sensors[1]).toEqual({ sensor: dnd.TouchSensor, options: { activationConstraint: { delay: 180, tolerance: 8 } } })
    expect(sensors[2].sensor).toBe(dnd.KeyboardSensor)

    const coordinateGetter = sensors[2].options.coordinateGetter as KeyboardCoordinateGetter
    const rect = (left: number) => ({ left, right: left + 100, top: 20, bottom: 320, width: 100, height: 300 })
    const entries = new Map(board.stages.map((stage) => [stage.id, { id: stage.id }]))
    const args = (overId: string) => ({
      active: item.id,
      currentCoordinates: { x: 0, y: 0 },
      context: {
        active: { data: { current: { item } } },
        over: { id: overId },
        droppableContainers: { get: (id: string) => entries.get(id) },
        droppableRects: new Map([['todo', rect(0)], ['review', rect(120)]]),
      },
    }) as unknown as Parameters<KeyboardCoordinateGetter>[1]

    expect(coordinateGetter(new KeyboardEvent('keydown', { code: 'ArrowRight' }), args('todo'))).toEqual({ x: 120, y: 20 })
    expect(coordinateGetter(new KeyboardEvent('keydown', { code: 'ArrowDown' }), args('todo'))).toEqual({ x: 120, y: 20 })
    expect(coordinateGetter(new KeyboardEvent('keydown', { code: 'ArrowLeft' }), args('review'))).toEqual({ x: 0, y: 20 })
    expect(coordinateGetter(new KeyboardEvent('keydown', { code: 'ArrowUp' }), args('review'))).toEqual({ x: 0, y: 20 })
    expect(coordinateGetter(new KeyboardEvent('keydown', { code: 'ArrowLeft' }), args('todo'))).toBeNull()
    expect(coordinateGetter(new KeyboardEvent('keydown', { code: 'Home' }), args('todo'))).toBeNull()
  })
  it('requires pointer containment before choosing the closest stage and preserves keyboard collisions', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const collisionDetection = dndHarness().collisionDetection
    const rect = (left: number) => ({ left, right: left + 100, top: 20, bottom: 320, width: 100, height: 300 })
    const containers = board.stages.map((stage) => ({ id: stage.id }))
    const baseArgs = {
      active: { id: item.id },
      collisionRect: rect(0),
      droppableContainers: containers,
      droppableRects: new Map([['todo', rect(0)], ['review', rect(120)]]),
    } as unknown as Parameters<CollisionDetection>[0]
    dnd.closestCorners.mockImplementation(({ droppableContainers }: Parameters<CollisionDetection>[0]) => droppableContainers.map((container) => ({ id: container.id })))

    expect(collisionDetection({ ...baseArgs, pointerCoordinates: { x: 170, y: 100 } })).toEqual([{ id: 'review' }])
    expect(dnd.closestCorners).toHaveBeenLastCalledWith(expect.objectContaining({ droppableContainers: [containers[1]] }))

    dnd.closestCorners.mockClear()
    expect(collisionDetection({ ...baseArgs, pointerCoordinates: { x: 221, y: 100 } })).toEqual([])
    expect(dnd.closestCorners).not.toHaveBeenCalled()

    expect(collisionDetection({ ...baseArgs, pointerCoordinates: null })).toEqual([{ id: 'todo' }, { id: 'review' }])
    expect(dnd.closestCorners).toHaveBeenLastCalledWith(expect.objectContaining({ droppableContainers: containers }))
  })
  it('registers stage-only drop targets and marks the active target', () => {
    dnd.overStageId = 'review'
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect([...new Set(dnd.droppableIds)]).toEqual(['todo', 'review'])
    expect(screen.getByRole('region', { name: 'Review stage' })).toHaveAttribute('data-drop-target', 'true')
    expect(screen.getByRole('region', { name: 'Preparation stage' })).not.toHaveAttribute('data-drop-target')
  })
  it('dims the source card while it is dragging', () => {
    dnd.draggingId = 'task-1'
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    expect(screen.getByRole('button', { name: 'Open July close details' }).closest('article')).toHaveStyle({ opacity: '0.55' })
  })
  it('renders a non-interactive overlay and announces public task and stage names', () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    const harness = dndHarness()
    const active = { data: { current: { item } } }

    act(() => harness.onDragStart({ active }))
    const overlay = within(screen.getByTestId('drag-overlay'))
    expect(overlay.getByText('FB-1042')).toBeInTheDocument()
    expect(overlay.queryByRole('button')).not.toBeInTheDocument()

    const announcements = harness.accessibility.announcements
    const messages = [
      announcements.onDragStart({ active }),
      announcements.onDragOver({ active, over: { id: 'review' } }),
      announcements.onDragEnd({ active, over: { id: 'review' } }),
      announcements.onDragCancel({ active, over: null }),
    ]
    expect(messages).toEqual([
      'Picked up FB-1042: July close. Stage: Preparation.',
      'Moved over FB-1042: July close. Stage: Review.',
      'Dropped FB-1042: July close. Stage: Review.',
      'Cancelled dragging FB-1042: July close. Stage: Preparation.',
    ])
    expect(messages.join(' ')).not.toContain('task-1')

    act(() => harness.onDragCancel({ active, over: null }))
    expect(overlay.queryByText('FB-1042')).not.toBeInTheDocument()
  })
  it('moves a card only through the confirmed mutation', async () => {
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Move right July close' }))
    await vi.waitFor(() => expect(mocks.move).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), workflowId: 'flow-1', itemId: 'task-1', targetStageId: 'review', expectedVersion: 0 })))
  })
  it('refetches only after a 409 move conflict and keeps the retry message', async () => {
    mocks.move.mockReturnValue({ unwrap: vi.fn().mockRejectedValue({ status: 409 }) })
    render(<WorkflowBoard workflowSlug="monthly-close" basePath="/firms/hearth/workflow/monthly-close" />)
    fireEvent.click(screen.getByRole('button', { name: 'Move right July close' }))
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
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    render(<TaskPanel detail={detail} boardPath="/firms/hearth/workflow/monthly-close?priority=URGENT" taskPath="/firms/hearth/workflow/monthly-close/tasks/FB-1042" />)
    expect(screen.getByRole('complementary', { name: 'July close details' })).toHaveAttribute('data-state', 'open')
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
