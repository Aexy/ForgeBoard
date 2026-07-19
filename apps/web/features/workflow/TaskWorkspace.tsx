'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Employee, useGetEmployeesQuery } from '@/features/employees/employees-transport'
import { useFirmContext } from '@/store/firm-cache-boundary'
import { useGetDocumentRequestsQuery, useGetWorkItemDetailQuery, useGetWorkflowBoardQuery, useLinkDocumentRequestMutation, useUnlinkDocumentRequestMutation, useUpdateWorkItemReviewerMutation } from './workflow-transport'
import styles from './WorkflowBoard.module.css'
import { useWorkflowLanguage } from './useWorkflowLanguage'

const canManage = (role: string) => role === 'OWNER' || role === 'ADMINISTRATOR'

export function TaskWorkspace({ workflowSlug, taskReference, workflowPath }: Readonly<{ workflowSlug: string; taskReference: string; workflowPath: string }>) {
  const router = useRouter(); const firm = useFirmContext(); const t = useWorkflowLanguage(); const privileged = canManage(firm.role)
  const detail = useGetWorkItemDetailQuery({ firm, workflowSlug, taskReference }); const board = useGetWorkflowBoardQuery({ firm, workflowSlug }); const employees = useGetEmployeesQuery({ firm }, { skip: !privileged }); const documents = useGetDocumentRequestsQuery({ firm }, { skip: !privileged })
  const [updateReviewer, reviewerResult] = useUpdateWorkItemReviewerMutation(); const [link, linkResult] = useLinkDocumentRequestMutation(); const [unlink, unlinkResult] = useUnlinkDocumentRequestMutation(); const [error, setError] = useState('')
  const available = useMemo(() => { if (!detail.data) return []; const linked = new Set(detail.data.documentRequests.map((request) => request.id)); return (documents.data ?? []).filter((request) => request.clientId === detail.data!.item.clientId && !linked.has(request.id)) }, [detail.data, documents.data])
  if (detail.isLoading) return <p aria-live="polite">{t('Loading task…')}</p>
  if (detail.isError || !detail.data) return <p role="alert">{t('This task is not available in this workflow.')}</p>
  const item = detail.data.item
  const assignReviewer = async (userId: string) => { if (!board.data) return; setError(''); try { await updateReviewer({ firm, workflowId: board.data.id, itemId: item.id, userId: userId || null }).unwrap() } catch { setError(t('The reviewer could not be updated.')) } }
  const changeLink = async (requestId: string, remove = false) => { if (!board.data) return; setError(''); try { await (remove ? unlink({ firm, workflowId: board.data.id, itemId: item.id, requestId }) : link({ firm, workflowId: board.data.id, itemId: item.id, requestId })).unwrap() } catch { setError(t('The document request could not be updated.')) } }
  return <section className={styles.taskWorkspace}><header className={styles.workspaceHeader}><div><p className={styles.eyebrow}>{t('Task workspace')} · {item.taskReference}</p><h1>{item.title}</h1><p className={styles.clientName}>{detail.data.clientDisplayName}</p></div><button type="button" className={styles.quietButton} onClick={() => router.replace(workflowPath)}>{t('Back to workflow')}</button></header>
    <div className={styles.taskWorkspaceGrid}><article><h2>{t('Task details')}</h2><p>{item.description || t('No description provided.')}</p><dl className={styles.metadata}><div><dt>{t('Owner')}</dt><dd>{item.ownerDisplayName ?? t('Unassigned')}</dd></div><div><dt>{t('Due date')}</dt><dd>{item.dueDate ?? t('No due date')}</dd></div><div><dt>{t('Priority')}</dt><dd>{item.priority.toLowerCase()}</dd></div></dl></article>
    <article><h2>{t('Review')}</h2>{privileged ? <label className={styles.fieldLabel}>{t('Reviewer')}<select aria-label={t('Select reviewer')} value={item.reviewerUserId ?? ''} onChange={(event) => void assignReviewer(event.target.value)} disabled={reviewerResult.isLoading || board.isLoading || !board.data}><option value="">{t('Unassigned')}</option>{(employees.data ?? []).map((employee: Employee) => <option key={employee.userId} value={employee.userId}>{employee.displayName}</option>)}</select></label> : <p>{item.reviewerDisplayName ?? t('No reviewer assigned.')}</p>}{item.ownerUserId && item.ownerUserId === item.reviewerUserId && <p className={styles.reviewWarning} role="status">{t('The owner is also the reviewer. This is allowed, but a separate reviewer is recommended.')}</p>}</article>
    <article className={styles.preview}><h2>{t('Linked document requests')}</h2>{detail.data.documentRequests.length ? <ul>{detail.data.documentRequests.map((request) => <li key={request.id}><strong>{request.label}</strong><span>{request.status.toLowerCase().replaceAll('_', ' ')}</span>{privileged && <button type="button" className={styles.quietButton} disabled={unlinkResult.isLoading || !board.data} aria-label={`Unlink ${request.label}`} onClick={() => void changeLink(request.id, true)}>Unlink</button>}</li>)}</ul> : <p>{t('No document requests linked.')}</p>}{privileged && <div className={styles.documentLinks}><h3>Available document requests</h3>{available.length ? <ul>{available.map((request) => <li key={request.id}><strong>{request.label}</strong><button type="button" className={styles.quietButton} disabled={linkResult.isLoading || !board.data} aria-label={`Link ${request.label}`} onClick={() => void changeLink(request.id)}>Link</button></li>)}</ul> : <p>No matching unlinked document requests.</p>}</div>}</article>
    <article className={styles.preview}><h2>{t('Recent activity')}</h2>{detail.data.activity.length ? <ol>{detail.data.activity.map((entry, index) => <li key={`${entry.occurredAt}-${index}`}><span>{entry.action.replaceAll('.', ' ')}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></li>)}</ol> : <p>{t('No activity recorded for this work item.')}</p>}</article></div>
    {error && <p role="alert" aria-live="assertive">{error}</p>}
  </section>
}
