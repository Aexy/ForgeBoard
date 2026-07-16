'use client'

import { useRouter } from 'next/navigation'
import { useFirmContext } from '@/store/firm-cache-boundary'
import { type Employee, useGetEmployeesQuery, useGetWorkItemDetailQuery, useUpdateWorkItemReviewerMutation } from '@/store/api'
import { useWorkflowLanguage } from './useWorkflowLanguage'

const canManageReview = (role: string) => role === 'OWNER' || role === 'ADMINISTRATOR'

export function TaskWorkspace({ workflowId, taskId }: Readonly<{ workflowId: string; taskId: string }>) {
  const router = useRouter(); const firm = useFirmContext()
  const t = useWorkflowLanguage()
  const detail = useGetWorkItemDetailQuery({ firm, workflowId, itemId: taskId })
  const employees = useGetEmployeesQuery({ firm }, { skip: !canManageReview(firm.role) })
  const [updateReviewer, result] = useUpdateWorkItemReviewerMutation()
  if (detail.isLoading) return <p aria-live="polite">{t('Loading task…')}</p>
  if (detail.isError || !detail.data) return <p role="alert">{t('This task is not available in this workflow.')}</p>
  const item = detail.data.item
  const assignReviewer = async (userId: string) => { await updateReviewer({ firm, workflowId, itemId: taskId, userId: userId || null }).unwrap() }
  return <section><button type="button" onClick={() => router.back()}>{t('Back to workflow')}</button><p>{t('Task workspace')}</p><h1>{item.title}</h1><p>{detail.data.clientDisplayName}</p>
    <h2>{t('Task details')}</h2><p>{item.description || t('No description provided.')}</p>
    <h2>{t('Review')}</h2>{canManageReview(firm.role) ? <label>{t('Reviewer')}<select aria-label={t('Select reviewer')} value={item.reviewerUserId ?? ''} onChange={(event) => void assignReviewer(event.target.value)} disabled={result.isLoading}><option value="">{t('Unassigned')}</option>{(employees.data ?? []).map((employee: Employee) => <option key={employee.userId} value={employee.userId}>{employee.displayName}</option>)}</select></label> : <p>{item.reviewerDisplayName ?? t('No reviewer assigned.')}</p>}
    {item.ownerUserId && item.ownerUserId === item.reviewerUserId && <p role="status">{t('The owner is also the reviewer. This is allowed, but a separate reviewer is recommended.')}</p>}
    <h2>{t('Linked document requests')}</h2>{detail.data.documentRequests.length ? <ul>{detail.data.documentRequests.map((request) => <li key={request.id}>{request.label} — {request.status.toLowerCase()}</li>)}</ul> : <p>{t('No document requests linked.')}</p>}
    <h2>{t('Recent activity')}</h2>{detail.data.activity.length ? <ol>{detail.data.activity.map((entry, index) => <li key={`${entry.occurredAt}-${index}`}>{entry.action.replaceAll('.', ' ')}</li>)}</ol> : <p>{t('No activity recorded for this work item.')}</p>}
  </section>
}
