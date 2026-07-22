'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Employee, useGetEmployeesQuery } from '@/features/employees/employees-transport'
import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
import { useGetDocumentRequestsQuery, useGetWorkItemDetailQuery, useGetWorkflowBoardQuery, useLinkDocumentRequestMutation, useUnlinkDocumentRequestMutation, useUpdateWorkItemReviewerMutation } from './workflow-transport'
import styles from './WorkflowBoard.module.css'

const canManage = (role: string) => role === 'OWNER' || role === 'ADMINISTRATOR'

export function TaskWorkspace({ workflowSlug, taskReference, workflowPath }: Readonly<{ workflowSlug: string; taskReference: string; workflowPath: string }>) {
  const router = useRouter(); const firm = useFirmContext(); const { t } = useLanguage(); const privileged = canManage(firm.role)
  const detail = useGetWorkItemDetailQuery({ firm, workflowSlug, taskReference }); const board = useGetWorkflowBoardQuery({ firm, workflowSlug }); const employees = useGetEmployeesQuery({ firm }, { skip: !privileged }); const documents = useGetDocumentRequestsQuery({ firm }, { skip: !privileged })
  const [updateReviewer, reviewerResult] = useUpdateWorkItemReviewerMutation(); const [link, linkResult] = useLinkDocumentRequestMutation(); const [unlink, unlinkResult] = useUnlinkDocumentRequestMutation(); const [error, setError] = useState('')
  const available = useMemo(() => { if (!detail.data) return []; const linked = new Set(detail.data.documentRequests.map((request) => request.id)); return (documents.data ?? []).filter((request) => request.clientId === detail.data!.item.clientId && !linked.has(request.id)) }, [detail.data, documents.data])
  if (detail.isLoading) return <p aria-live="polite">{t('workflow.loadingTask')}</p>
  if (detail.isError || !detail.data) return <p role="alert">{t('workflow.taskUnavailable')}</p>
  const item = detail.data.item
  const assignReviewer = async (userId: string) => { if (!board.data) return; setError(''); try { await updateReviewer({ firm, workflowId: board.data.id, itemId: item.id, userId: userId || null }).unwrap() } catch { setError(t('workflow.reviewerUpdateError')) } }
  const changeLink = async (requestId: string, remove = false) => { if (!board.data) return; setError(''); try { await (remove ? unlink({ firm, workflowId: board.data.id, itemId: item.id, requestId }) : link({ firm, workflowId: board.data.id, itemId: item.id, requestId })).unwrap() } catch { setError(t('workflow.documentRequestUpdateError')) } }
  return <section className={styles.taskWorkspace}><header className={styles.workspaceHeader}><div><p className={styles.eyebrow}>{t('workflow.taskWorkspace')} · {item.taskReference}</p><h1>{item.title}</h1><p className={styles.clientName}>{detail.data.clientDisplayName}</p></div><button type="button" className={styles.quietButton} onClick={() => router.replace(workflowPath)}>{t('workflow.backToWorkflow')}</button></header>
    <div className={styles.taskWorkspaceGrid}><article><h2>{t('workflow.taskDetails')}</h2><p>{item.description || t('workflow.noDescription')}</p><dl className={styles.metadata}><div><dt>{t('common.owner')}</dt><dd>{item.ownerDisplayName ?? t('common.unassigned')}</dd></div><div><dt>{t('common.dueDate')}</dt><dd>{item.dueDate ?? t('common.noDeadline')}</dd></div><div><dt>{t('common.priority')}</dt><dd>{item.priority.toLowerCase()}</dd></div></dl></article>
    <article><h2>{t('workflow.review')}</h2>{privileged ? <label className={styles.fieldLabel}>{t('common.reviewer')}<select aria-label={t('workflow.selectReviewer')} value={item.reviewerUserId ?? ''} onChange={(event) => void assignReviewer(event.target.value)} disabled={reviewerResult.isLoading || board.isLoading || !board.data}><option value="">{t('common.unassigned')}</option>{(employees.data ?? []).map((employee: Employee) => <option key={employee.userId} value={employee.userId}>{employee.displayName}</option>)}</select></label> : <p>{item.reviewerDisplayName ?? t('workflow.noReviewer')}</p>}{item.ownerUserId && item.ownerUserId === item.reviewerUserId && <p className={styles.reviewWarning} role="status">{t('workflow.reviewerWarning')}</p>}</article>
    <article className={styles.preview}><h2>{t('workflow.linkedDocumentRequests')}</h2>{detail.data.documentRequests.length ? <ul>{detail.data.documentRequests.map((request) => <li key={request.id}><strong>{request.label}</strong><span>{request.status === 'RECEIVED' ? t('workflow.documentStatusReceived') : t('workflow.documentStatusRequested')}</span>{privileged && <button type="button" className={styles.quietButton} disabled={unlinkResult.isLoading || !board.data} aria-label={`${t('workflow.unlink')} ${request.label}`} onClick={() => void changeLink(request.id, true)}>{t('workflow.unlink')}</button>}</li>)}</ul> : <p>{t('workflow.noDocumentRequests')}</p>}{privileged && <div className={styles.documentLinks}><h3>{t('workflow.availableDocumentRequests')}</h3>{available.length ? <ul>{available.map((request) => <li key={request.id}><strong>{request.label}</strong><button type="button" className={styles.quietButton} disabled={linkResult.isLoading || !board.data} aria-label={`${t('workflow.link')} ${request.label}`} onClick={() => void changeLink(request.id)}>{t('workflow.link')}</button></li>)}</ul> : <p>{t('workflow.noMatchingDocumentRequests')}</p>}</div>}</article>
    <article className={styles.preview}><h2>{t('workflow.recentActivity')}</h2>{detail.data.activity.length ? <ol>{detail.data.activity.map((entry, index) => <li key={`${entry.occurredAt}-${index}`}><span>{entry.action.replaceAll('.', ' ')}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></li>)}</ol> : <p>{t('workflow.noActivity')}</p>}</article></div>
    {error && <p role="alert" aria-live="assertive">{error}</p>}
  </section>
}
