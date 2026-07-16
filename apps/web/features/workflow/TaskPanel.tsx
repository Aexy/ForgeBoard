'use client'

import { useRouter } from 'next/navigation'
import type { WorkItemDetail } from '@/store/api'
import styles from './WorkflowBoard.module.css'
import { useWorkflowLanguage } from './useWorkflowLanguage'

export function TaskPanel({ detail, taskPath }: Readonly<{ detail: WorkItemDetail; taskPath: string }>) {
  const router = useRouter()
  const t = useWorkflowLanguage()
  return <aside aria-label={`${detail.item.title} details`} className={styles.taskPanel}>
    <button type="button" onClick={() => router.back()}>{t('Close')}</button>
    <p>{t('Work item')}</p><h2>{detail.item.title}</h2><p>{detail.clientDisplayName}</p>
    <dl><div><dt>{t('Owner')}</dt><dd>{detail.item.ownerDisplayName ?? t('Unassigned')}</dd></div><div><dt>{t('Reviewer')}</dt><dd>{detail.item.reviewerDisplayName ?? t('Unassigned')}</dd></div><div><dt>{t('Due state')}</dt><dd>{detail.item.dueDate ?? t('No due date')}</dd></div></dl>
    <button type="button" onClick={() => router.push(taskPath)}>{t('Open task workspace')}</button>
  </aside>
}
