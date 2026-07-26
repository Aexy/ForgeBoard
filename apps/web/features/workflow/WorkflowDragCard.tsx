'use client'

import { useDraggable } from '@dnd-kit/core'

import { useLanguage } from '@/app/LanguageProvider'
import type { WorkItem } from './workflow-transport'
import styles from './WorkflowDragCard.module.css'

export type WorkflowDragCardProps = {
  item: WorkItem
  canMove: boolean
  isSaving: boolean
  stageIndex: number
  stageCount: number
  onOpen: (item: WorkItem) => void
  onOpenWorkspace: (item: WorkItem) => void
  onMove: (item: WorkItem, targetStageIndex: number) => void
}

function dueState(date: string | null) { if (!date) return 'none'; const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(`${date}T00:00:00`); const days = Math.round((due.getTime() - today.getTime()) / 86400000); return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'soon' : 'later' }

function WorkflowCardSummary({ item }: Readonly<{ item: WorkItem }>) {
  const { t } = useLanguage()
  return <>
    <p className={styles.cardReference}>{item.taskReference}</p>
    <h3>{item.title}</h3>
    <p className={styles.assignment}>{t('workflow.assigned')} {item.ownerDisplayName ?? t('common.unassigned')}</p>
    <div className={styles.cardBadges}><span data-due={dueState(item.dueDate)}>{item.dueDate ? `${t('common.due')} ${item.dueDate}` : t('common.noDeadline')}</span><span>{item.priority.toLowerCase()}</span></div>
  </>
}

export function WorkflowDragOverlayCard({ item }: Readonly<{ item: WorkItem }>) {
  return <article className={styles.card} aria-hidden="true"><div className={styles.cardActivation}><WorkflowCardSummary item={item} /></div></article>
}

export function WorkflowDragCard({ item, canMove, isSaving, stageIndex, stageCount, onOpen, onOpenWorkspace, onMove }: Readonly<WorkflowDragCardProps>) {
  const { t } = useLanguage()
  const draggable = useDraggable({ id: item.id, disabled: !canMove, data: { item } })
  const transform = draggable.transform && !draggable.isDragging ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` : undefined

  return <article ref={draggable.setNodeRef} className={styles.card} data-dragging={draggable.isDragging ? 'true' : undefined} style={{ opacity: draggable.isDragging ? .55 : undefined, transform }}>
    {canMove && <button type="button" ref={draggable.setActivatorNodeRef} className={styles.dragHandle} aria-label={`${t('workflow.dragHandle')} ${item.taskReference}: ${item.title}`} {...draggable.listeners} {...draggable.attributes}>⠿</button>}
    <button type="button" className={styles.cardActivation} aria-label={`${t('common.open')} ${item.title} ${t('common.details')}`} onClick={() => onOpen(item)} onDoubleClick={() => onOpenWorkspace(item)}>
      <WorkflowCardSummary item={item} />
    </button>
    <div className={styles.cardActions}>
      <button type="button" aria-label={`${t('workflow.moveLeft')} ${item.title}`} disabled={stageIndex === 0 || isSaving} onClick={(event) => { event.stopPropagation(); onMove(item, stageIndex - 1) }}>←</button>
      <button type="button" aria-label={`${t('common.open')} ${item.title} ${t('workflow.taskWorkspace').toLowerCase()}`} onClick={(event) => { event.stopPropagation(); onOpenWorkspace(item) }}>{t('workflow.openTaskWorkspace')}</button>
      <button type="button" aria-label={`${t('workflow.moveRight')} ${item.title}`} disabled={stageIndex === stageCount - 1 || isSaving} onClick={(event) => { event.stopPropagation(); onMove(item, stageIndex + 1) }}>→</button>
    </div>
  </article>
}
