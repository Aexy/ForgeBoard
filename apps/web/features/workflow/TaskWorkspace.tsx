'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useGetWorkItemDetailQuery, useGetWorkflowBoardQuery, useUpdateWorkItemReviewerMutation } from './workflow-transport'
import { type Employee, useGetEmployeesQuery } from '@/features/employees/employees-transport'

import styles from './WorkflowBoard.module.css'
import { useWorkflowLanguage } from './useWorkflowLanguage'

const canManageReview = (role: string) => role === 'OWNER' || role === 'ADMINISTRATOR'

export function TaskWorkspace({ workflowSlug, taskReference, workflowPath }: Readonly<{ workflowSlug: string; taskReference: string; workflowPath: string }>) {
  const router = useRouter(); const firm = useFirmContext()
  const t = useWorkflowLanguage()
  const detail = useGetWorkItemDetailQuery({ firm, workflowSlug, taskReference })
  const board = useGetWorkflowBoardQuery({ firm, workflowSlug })
  const employees = useGetEmployeesQuery({ firm }, { skip: !canManageReview(firm.role) })
  const [updateReviewer, result] = useUpdateWorkItemReviewerMutation()
  const [reviewerError, setReviewerError] = useState('')
  if (detail.isLoading) return <p aria-live="polite">{t('Loading task…')}</p>
  if (detail.isError || !detail.data) return <p role="alert">{t('This task is not available in this workflow.')}</p>
  const item = detail.data.item
  const assignReviewer = async (userId: string) => { if (!board.data) return; setReviewerError(''); try { await updateReviewer({ firm, workflowId: board.data.id, itemId: item.id, userId: userId || null }).unwrap() } catch { setReviewerError(t('The reviewer could not be updated.')) } }
  return <section className={styles.taskWorkspace}><header className={styles.workspaceHeader}><div><p className={styles.eyebrow}>{t('Task workspace')} · {item.taskReference}</p><h1>{item.title}</h1><p className={styles.clientName}>{detail.data.clientDisplayName}</p></div><button type="button" className={styles.quietButton} onClick={() => router.replace(workflowPath)}>{t('Back to workflow')}</button></header>
    <div className={styles.taskWorkspaceGrid}><article><h2>{t('Task details')}</h2><p>{item.description || t('No description provided.')}</p><dl className={styles.metadata}><div><dt>{t('Owner')}</dt><dd>{item.ownerDisplayName ?? t('Unassigned')}</dd></div><div><dt>{t('Due date')}</dt><dd>{item.dueDate ?? t('No due date')}</dd></div><div><dt>{t('Priority')}</dt><dd>{item.priority.toLowerCase()}</dd></div></dl></article>
    <article><h2>{t('Review')}</h2>{canManageReview(firm.role) ? <label className={styles.fieldLabel}>{t('Reviewer')}<select aria-label={t('Select reviewer')} value={item.reviewerUserId ?? ''} onChange={(event) => void assignReviewer(event.target.value)} disabled={result.isLoading || board.isLoading || !board.data}><option value="">{t('Unassigned')}</option>{(employees.data ?? []).map((employee: Employee) => <option key={employee.userId} value={employee.userId}>{employee.displayName}</option>)}</select></label> : <p>{item.reviewerDisplayName ?? t('No reviewer assigned.')}</p>}
    {reviewerError && <p role="alert" aria-live="assertive">{reviewerError}</p>}
    {item.ownerUserId && item.ownerUserId === item.reviewerUserId && <p className={styles.reviewWarning} role="status">{t('The owner is also the reviewer. This is allowed, but a separate reviewer is recommended.')}</p>}</article>
    <article className={styles.preview}><h2>{t('Linked document requests')}</h2>{detail.data.documentRequests.length ? <ul>{detail.data.documentRequests.map((request) => <li key={request.id}><strong>{request.label}</strong><span>{request.status.toLowerCase().replaceAll('_', ' ')}</span></li>)}</ul> : <p>{t('No document requests linked.')}</p>}</article>
    <article className={styles.preview}><h2>{t('Recent activity')}</h2>{detail.data.activity.length ? <ol>{detail.data.activity.map((entry, index) => <li key={`${entry.occurredAt}-${index}`}><span>{entry.action.replaceAll('.', ' ')}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></li>)}</ol> : <p>{t('No activity recorded for this work item.')}</p>}</article></div>
  </section>
}
