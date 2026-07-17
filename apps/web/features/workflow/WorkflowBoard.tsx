'use client'

import { DragEvent, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { type WorkItem, type WorkflowBoard as Board, useGetWorkItemDetailQuery, useGetWorkflowBoardQuery, useGetWorkflowViewsQuery, useMoveWorkItemMutation } from '@/store/api'

import { WorkflowFilters } from './WorkflowFilters'
import { TaskPanel } from './TaskPanel'
import styles from './WorkflowBoard.module.css'
import { useWorkflowLanguage } from './useWorkflowLanguage'
import { boardPathWithoutTask, filtersFromSearch, taskPanelPath, taskWorkspacePath } from './workflow-route-state'

function dueState(date: string | null) { if (!date) return 'none'; const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(`${date}T00:00:00`); const days = Math.round((due.getTime() - today.getTime()) / 86400000); return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'soon' : 'later' }
function visible(item: WorkItem, filters: ReturnType<typeof filtersFromSearch>) { return (!filters.client || item.clientId === filters.client) && (!filters.owner || item.ownerUserId === filters.owner) && (!filters.due || dueState(item.dueDate) === filters.due) && (!filters.priority || item.priority === filters.priority) && (!filters.unassigned || !item.ownerUserId) }
function errorStatus(error: unknown) { return typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined }
function attentionMark(attention: string) { return attention === 'BLOCKED' ? '!' : attention === 'AWAITING_REVIEW' ? '✓' : '•' }

export function WorkflowBoard({ workflowSlug, basePath }: Readonly<{ workflowSlug: string; basePath: string }>) {
  const firm = useFirmContext(); const router = useRouter(); const search = useSearchParams(); const filters = filtersFromSearch(search)
  const t = useWorkflowLanguage()
  const board = useGetWorkflowBoardQuery({ firm, workflowSlug }); const taskReference = search.get('task'); const task = useGetWorkItemDetailQuery({ firm, workflowSlug, taskReference: taskReference ?? '' }, { skip: !taskReference })
  const savedViews = useGetWorkflowViewsQuery({ firm })
  const [move, moveResult] = useMoveWorkItemMutation(); const [dragged, setDragged] = useState<WorkItem | null>(null); const [message, setMessage] = useState('')
  const stages = useMemo(() => board.data?.stages.map((stage) => ({ ...stage, items: stage.items.filter((item) => visible(item, filters)) })) ?? [], [board.data, filters])
  const openTask = (item: WorkItem, workspace = false) => { if (workspace) router.push(taskWorkspacePath(basePath, item.taskReference)); else router.push(taskPanelPath(basePath, search, item.taskReference)) }
  const persistMove = async (item: WorkItem, targetStageId: string) => { if (item.stageId === targetStageId) return; setMessage(''); try { await move({ firm, workflowId: board.data!.id, itemId: item.id, targetStageId, expectedVersion: item.version }).unwrap(); setMessage(`${item.title} moved.`) } catch (error) { if (errorStatus(error) === 409) { board.refetch(); setMessage('This work item was changed by another user. The board was refreshed; retry your move.') } else setMessage('The work item could not be moved.') } finally { setDragged(null) } }
  if (board.isLoading) return <p aria-live="polite">{t('Loading workflow…')}</p>
  if (board.isError || !board.data) return <p role="alert">{t('The workflow could not be loaded.')}</p>
  const source: Board = board.data
  const totalItems = source.stages.reduce((count, stage) => count + stage.items.length, 0)

  return <section className={styles.workspace}>
    <header className={styles.workspaceHeader}><div><p className={styles.eyebrow}>{t('Client work')}</p><h1>{source.name}</h1><p>{t('Track every engagement from client request through review.')}</p></div><span className={styles.itemCount}>{totalItems} {t('open work items')}</span></header>
    <WorkflowFilters basePath={basePath} savedViews={savedViews.data} />
    <p className="srOnly" aria-live="polite">{message}</p>{message && <p role="alert">{t(message)}</p>}
    <div className={taskReference && task.data ? styles.boardAndPanel : undefined}>
      <div className={styles.board} aria-label={`${source.name} workflow`}><p className="srOnly">{t('Drag a work item to another stage, or use its move left and move right buttons.')}</p>{stages.map((stage, index) => <section key={stage.id} className={styles.column} data-attention={stage.attention} aria-label={`${stage.name} stage`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragged) void persistMove(dragged, stage.id) }}><div className={styles.columnTitle}><span className={styles.stageMarker} aria-hidden="true">{attentionMark(stage.attention)}</span><h2>{stage.name}</h2><span className={styles.stageCount}>{stage.items.length}</span></div>{stage.items.map((item) => <article key={item.id} className={styles.card} draggable={!moveResult.isLoading} onDragStart={(event: DragEvent<HTMLElement>) => { setDragged(item); event.dataTransfer.setData('text/forgeboard-item', item.id) }} onDragEnd={() => setDragged(null)}><button type="button" className={styles.cardActivation} aria-label={`${t('Open')} ${item.title} ${t('details')}`} onClick={() => openTask(item)} onDoubleClick={() => openTask(item, true)}><p className={styles.cardReference}>{item.taskReference}</p><h3>{item.title}</h3><p className={styles.assignment}>{t('Assigned:')} {item.ownerDisplayName ?? t('Unassigned')}</p><div className={styles.cardBadges}><span data-due={dueState(item.dueDate)}>{item.dueDate ? `${t('Due')} ${item.dueDate}` : t('No due date')}</span><span>{item.priority.toLowerCase()}</span></div></button><div className={styles.cardActions}><button type="button" aria-label={`Move ${item.title} left`} disabled={index === 0 || moveResult.isLoading} onClick={(event) => { event.stopPropagation(); void persistMove(item, source.stages[index - 1].id) }}>←</button><button type="button" aria-label={`Open ${item.title} task workspace`} onClick={(event) => { event.stopPropagation(); openTask(item, true) }}>{t('Open task workspace')}</button><button type="button" aria-label={`Move ${item.title} right`} disabled={index === source.stages.length - 1 || moveResult.isLoading} onClick={(event) => { event.stopPropagation(); void persistMove(item, source.stages[index + 1].id) }}>→</button></div></article>)}{stage.items.length === 0 && <p className={styles.emptyStage}>{t('No work items in this stage.')}</p>}</section>)}</div>
      {taskReference && task.data && <TaskPanel detail={task.data} boardPath={boardPathWithoutTask(basePath, search)} taskPath={taskWorkspacePath(basePath, taskReference)} />}
    </div>
    {taskReference && task.isError && <p role="alert">{t('This task is not available in this workflow.')}</p>}
  </section>
}
