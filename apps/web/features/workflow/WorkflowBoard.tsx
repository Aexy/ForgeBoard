'use client'

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useGetClientsQuery } from '@/features/clients/clients-transport'
import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
import { useBoardOperations } from './board-operations'
import { type WorkItem, type WorkflowBoard as Board, useGetWorkflowsQuery, useGetWorkItemDetailQuery, useGetWorkflowBoardQuery, useGetWorkflowViewsQuery } from './workflow-transport'
import { WorkflowFilters } from './WorkflowFilters'
import { CreateWorkflowForm } from './CreateWorkflowForm'
import { TaskPanel } from './TaskPanel'
import { WorkflowDragCard, WorkflowDragOverlayCard } from './WorkflowDragCard'
import styles from './WorkflowBoard.module.css'
import { boardPathWithoutTask, filtersFromSearch, taskPanelPath, taskWorkspacePath } from './workflow-route-state'

function dueState(date: string | null) { if (!date) return 'none'; const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(`${date}T00:00:00`); const days = Math.round((due.getTime() - today.getTime()) / 86400000); return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'soon' : 'later' }
function visible(item: WorkItem, filters: ReturnType<typeof filtersFromSearch>) { return (!filters.client || item.clientId === filters.client) && (!filters.owner || item.ownerUserId === filters.owner) && (!filters.due || dueState(item.dueDate) === filters.due) && (!filters.priority || item.priority === filters.priority) && (!filters.unassigned || !item.ownerUserId) }
function attentionMark(attention: string) { return attention === 'BLOCKED' ? '!' : attention === 'AWAITING_REVIEW' ? '✓' : '•' }

function createWorkflowStageKeyboardCoordinates(stageIds: string[]): KeyboardCoordinateGetter {
  return ((event, { context }) => {
    const offset = event.code === 'ArrowRight' || event.code === 'ArrowDown'
      ? 1
      : event.code === 'ArrowLeft' || event.code === 'ArrowUp'
        ? -1
        : 0
    if (offset === 0) return null
    event.preventDefault()

    const activeItem = context.active?.data.current?.item as WorkItem | undefined
    const overStageId = typeof context.over?.id === 'string' ? context.over.id : undefined
    const currentStageId = overStageId && stageIds.includes(overStageId) ? overStageId : activeItem?.stageId
    const registeredStageIds = stageIds.filter((stageId) => context.droppableContainers.get(stageId) && context.droppableRects.get(stageId))
    const currentIndex = currentStageId ? registeredStageIds.indexOf(currentStageId) : -1
    const targetStageId = registeredStageIds[currentIndex + offset]
    const targetRect = targetStageId ? context.droppableRects.get(targetStageId) : undefined
    return targetRect ? { x: targetRect.left, y: targetRect.top } : null
  }) as KeyboardCoordinateGetter
}

function WorkflowStageDropTarget({ stageId, attention, label, children }: Readonly<{ stageId: string; attention: string; label: string; children: ReactNode }>) {
  const droppable = useDroppable({ id: stageId, data: { stageId } })
  return <section ref={droppable.setNodeRef} className={styles.column} data-attention={attention} data-drop-target={droppable.isOver ? 'true' : undefined} aria-label={label}>{children}</section>
}

function useMobileWorkflowLayout() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 50rem)')
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isMobile
}

type StageContentState = 'closed' | 'closing' | 'open' | 'opening'

function WorkflowStageContent({ children, id, isExpanded, isMobile }: Readonly<{ children: ReactNode; id: string; isExpanded: boolean; isMobile: boolean }>) {
  const [state, setState] = useState<StageContentState>(() => isMobile && !isExpanded ? 'closed' : 'open')
  const wasMobile = useRef(isMobile)

  useEffect(() => {
    const enteredMobileLayout = isMobile && !wasMobile.current
    wasMobile.current = isMobile
    if (!isMobile) {
      setState('open')
    } else if (enteredMobileLayout) {
      setState(isExpanded ? 'open' : 'closed')
    } else {
      setState((current) => {
        if (isExpanded) return current === 'closed' || current === 'closing' ? 'opening' : current
        return current === 'open' || current === 'opening' ? 'closing' : current
      })
    }
  }, [isExpanded, isMobile])

  return <div
    id={id}
    hidden={isMobile && state === 'closed'}
    className={styles.stageContent}
    data-state={isMobile ? state : 'open'}
    onTransitionEnd={(event) => {
      if (event.currentTarget !== event.target) return
      setState((current) => current === 'closing' ? 'closed' : current === 'opening' ? 'open' : current)
    }}
  >
    {children}
  </div>
}

export function WorkflowBoard({ workflowSlug, basePath }: Readonly<{ workflowSlug: string; basePath: string }>) {
  const firm = useFirmContext(); const router = useRouter(); const search = useSearchParams(); const filters = filtersFromSearch(search); const { t } = useLanguage()
  const board = useGetWorkflowBoardQuery({ firm, workflowSlug }); const taskReference = search.get('task'); const task = useGetWorkItemDetailQuery({ firm, workflowSlug, taskReference: taskReference ?? '' }, { skip: !taskReference }); const savedViews = useGetWorkflowViewsQuery({ firm }); const workflows = useGetWorkflowsQuery({ firm }); const clients = useGetClientsQuery({ firm })
  const [message, setMessage] = useState(''); const [newStageId, setNewStageId] = useState<string | null>(null); const [expandedStageIds, setExpandedStageIds] = useState<string[]>([]); const [activeItem, setActiveItem] = useState<WorkItem | null>(null)
  const isMobile = useMobileWorkflowLayout()
  const operations = useBoardOperations({ firm, workflowId: board.data?.id ?? '', refetchBoard: board.refetch })
  const stages = useMemo(() => board.data?.stages.map((stage) => ({ ...stage, items: stage.items.filter((item) => visible(item, filters)) })) ?? [], [board.data, filters])
  const stageIds = useMemo(() => board.data?.stages.map((stage) => stage.id) ?? [], [board.data?.stages])
  const stageNames = useMemo(() => new Map(board.data?.stages.map((stage) => [stage.id, stage.name]) ?? []), [board.data?.stages])
  const workflowStageKeyboardCoordinates = useMemo(() => createWorkflowStageKeyboardCoordinates(stageIds), [stageIds])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: workflowStageKeyboardCoordinates }),
  )
  const announcements = useMemo<Announcements>(() => {
    const announce = (message: string, item: WorkItem | undefined, stageId: string | undefined) => {
      const stageName = stageId ? stageNames.get(stageId) : undefined
      return item && stageName ? `${message} ${item.taskReference}: ${item.title}. ${t('workflow.stage')}: ${stageName}.` : undefined
    }
    return {
      onDragStart: ({ active }) => {
        const item = active.data.current?.item as WorkItem | undefined
        return announce(t('workflow.dragStart'), item, item?.stageId)
      },
      onDragOver: ({ active, over }) => announce(t('workflow.dragOver'), active.data.current?.item as WorkItem | undefined, typeof over?.id === 'string' ? over.id : undefined),
      onDragEnd: ({ active, over }) => {
        const item = active.data.current?.item as WorkItem | undefined
        return announce(t('workflow.dragEnd'), item, typeof over?.id === 'string' ? over.id : item?.stageId)
      },
      onDragCancel: ({ active }) => {
        const item = active.data.current?.item as WorkItem | undefined
        return announce(t('workflow.dragCancel'), item, item?.stageId)
      },
    }
  }, [stageNames, t])
  useEffect(() => {
    const initialStage = board.data?.stages.find((stage) => stage.items.length > 0) ?? board.data?.stages[0]
    setExpandedStageIds(initialStage ? [initialStage.id] : [])
  }, [board.data?.id])
  if (board.isLoading) return <p aria-live="polite">{t('workflow.loading')}</p>
  if (board.isError || !board.data) return <p role="alert">{t('workflow.loadError')}</p>
  const source: Board = board.data; const totalItems = source.stages.reduce((count, stage) => count + stage.items.length, 0)
  const openTask = (item: WorkItem, workspace = false) => { if (workspace) router.push(taskWorkspacePath(basePath, item.taskReference)); else router.push(taskPanelPath(basePath, search, item.taskReference)) }
  const persistMove = async (item: WorkItem, targetStageId: string) => { if (item.stageId === targetStageId) return; setMessage(''); try { await operations.move(item, targetStageId); setMessage(`${item.title} ${t('workflow.moved')}`) } catch (error) { setMessage(error instanceof Error && error.message.startsWith('This work item was changed') ? t('workflow.moveConflict') : t('workflow.moveError')) } }
  const onDragStart = (event: DragStartEvent) => setActiveItem((event.active.data.current?.item as WorkItem | undefined) ?? null)
  async function onDragEnd(event: DragEndEvent) {
    const item = event.active.data.current?.item as WorkItem | undefined
    const targetStageId = typeof event.over?.id === 'string' ? event.over.id : undefined
    try {
      if (item && targetStageId && item.stageId !== targetStageId && firm.role !== 'READ_ONLY' && !operations.isSaving) {
        await persistMove(item, targetStageId)
      }
    } finally {
      setActiveItem(null)
    }
  }
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!newStageId) return; const form = event.currentTarget; const data = new FormData(form); setMessage(''); try { await operations.create(newStageId, { clientId: String(data.get('clientId')), title: String(data.get('title')).trim(), description: String(data.get('description')).trim(), dueDate: String(data.get('dueDate')) || null, priority: String(data.get('priority')) as WorkItem['priority'] }); form.reset(); setNewStageId(null); setMessage(t('workflow.workItemCreated')) } catch { setMessage(t('workflow.workItemCreateError')) } }
  const activeClients = (clients.data ?? []).filter((client) => client.status === 'ACTIVE')
  return <section className={styles.workspace}>
    <header className={styles.workspaceHeader}><div><p className={styles.eyebrow}>{t('workflow.clientWork')}</p><h1>{source.name}</h1><p className={styles.description}>{t('workflow.description')}</p><CreateWorkflowForm /></div><span className={styles.itemCount}>{totalItems} {t('workflow.openWorkItems')}</span></header>
    <WorkflowFilters basePath={basePath} savedViews={savedViews.data} workflows={workflows.data} />
    <p className="srOnly" aria-live="polite">{message}</p>{message && <p role="alert">{message}</p>}
    <div className={taskReference && task.data ? styles.boardAndPanel : undefined}><DndContext sensors={sensors} collisionDetection={closestCorners} accessibility={{ announcements }} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveItem(null)}><div className={styles.board} aria-label={`${source.name} ${t('navigation.workflow').toLowerCase()}`}><p className="srOnly">{t('workflow.dragHelp')}</p>{stages.map((stage, index) => {
      const isExpanded = !isMobile || expandedStageIds.includes(stage.id)
      const stageContentId = `workflow-stage-${stage.id}`
      return <WorkflowStageDropTarget key={stage.id} stageId={stage.id} attention={stage.attention} label={`${stage.name} ${t('workflow.stage').toLowerCase()}`}><div className={styles.columnTitle}><span className={styles.stageMarker} aria-hidden="true">{attentionMark(stage.attention)}</span><h2>{stage.name}</h2><span className={styles.stageCount}>{stage.items.length}</span></div><button type="button" className={styles.mobileStageToggle} aria-label={`${t('workflow.toggleStage')} ${stage.name}`} aria-expanded={isExpanded} aria-controls={stageContentId} onClick={() => setExpandedStageIds((current) => current.includes(stage.id) ? current.filter((id) => id !== stage.id) : [...current, stage.id])}><span className={styles.stageMarker} aria-hidden="true">{attentionMark(stage.attention)}</span><span>{stage.name}</span><span className={styles.stageCount}>{stage.items.length}</span></button><WorkflowStageContent id={stageContentId} isExpanded={isExpanded} isMobile={isMobile}>{stage.items.map((item) => <WorkflowDragCard key={item.id} item={item} canMove={firm.role !== 'READ_ONLY' && !operations.isSaving} isSaving={operations.isSaving} stageIndex={index} stageCount={source.stages.length} onOpen={(selected) => openTask(selected)} onOpenWorkspace={(selected) => openTask(selected, true)} onMove={(selected, targetIndex) => void persistMove(selected, source.stages[targetIndex].id)} />)}{firm.role !== 'READ_ONLY' && (newStageId === stage.id ? <form className={styles.newItemForm} aria-label={t('workflow.newWorkItem')} onSubmit={(event) => void create(event)}><label>{t('common.client')}<select name="clientId" required defaultValue=""><option value="" disabled>{t('workflow.selectClient')}</option>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label><label>{t('workflow.title')}<input name="title" required maxLength={200} /></label><label>Description<textarea name="description" maxLength={10000} /></label><label>{t('common.dueDate')}<input name="dueDate" type="date" /></label><label>{t('common.priority')}<select name="priority" defaultValue="NORMAL"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label><div><button className={styles.primaryButton} disabled={operations.isSaving || activeClients.length === 0}>{operations.isSaving ? t('workflow.creating') : t('workflow.createWorkItem')}</button><button type="button" className={styles.quietButton} onClick={() => setNewStageId(null)}>{t('common.cancel')}</button></div></form> : <button type="button" className={styles.addItemButton} aria-label={`${t('workflow.addWorkItemTo')} ${stage.name}`} onClick={() => setNewStageId(stage.id)}>{t('workflow.addWorkItem')}</button>)}{stage.items.length === 0 && <p className={styles.emptyStage}>{t('workflow.noWorkItemsInStage')}</p>}</WorkflowStageContent></WorkflowStageDropTarget>
    })}</div><DragOverlay className={styles.dragOverlay}>{activeItem ? <WorkflowDragOverlayCard item={activeItem} /> : null}</DragOverlay></DndContext>{taskReference && task.data && <TaskPanel detail={task.data} boardPath={boardPathWithoutTask(basePath, search)} taskPath={taskWorkspacePath(basePath, taskReference)} />}</div>
    {taskReference && task.isError && <p role="alert">{t('workflow.taskUnavailable')}</p>}
  </section>
}
