'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import type { WorkItemDetail } from './workflow-transport'

import styles from './WorkflowBoard.module.css'
import { useLanguage } from '@/app/LanguageProvider'

export function TaskPanel({ detail, taskPath, boardPath }: Readonly<{ detail: WorkItemDetail; taskPath: string; boardPath: string }>) {
  const router = useRouter()
  const { t } = useLanguage()
  const panel = useRef<HTMLElement>(null)
  const close = () => router.replace(boardPath)

  useEffect(() => {
    panel.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  })

  return <aside ref={panel} aria-label={`${detail.item.title} details`} className={styles.taskPanel} tabIndex={-1}>
    <div className={styles.panelHeading}><div><p className={styles.eyebrow}>{t('workflow.workItem')} · {detail.item.taskReference}</p><h2>{detail.item.title}</h2></div><button type="button" className={styles.quietButton} onClick={close}>{t('common.close')}</button></div>
    <p className={styles.clientName}>{detail.clientDisplayName}</p>
    <button type="button" className={styles.primaryButton} onClick={() => router.push(taskPath)}>{t('workflow.openTaskWorkspace')}</button>
    {detail.item.description && <p className={styles.description}>{detail.item.description}</p>}
    <dl className={styles.metadata}><div><dt>{t('common.owner')}</dt><dd>{detail.item.ownerDisplayName ?? t('common.unassigned')}</dd></div><div><dt>{t('common.reviewer')}</dt><dd>{detail.item.reviewerDisplayName ?? t('common.unassigned')}</dd></div><div><dt>{t('common.dueDate')}</dt><dd>{detail.item.dueDate ?? t('common.noDeadline')}</dd></div><div><dt>{t('common.priority')}</dt><dd>{detail.item.priority.toLowerCase()}</dd></div></dl>
    <section className={styles.preview} aria-labelledby="panel-documents"><h3 id="panel-documents">{t('workflow.linkedDocumentRequests')}</h3>{detail.documentRequests.length ? <ul>{detail.documentRequests.slice(0, 3).map((request) => <li key={request.id}><strong>{request.label}</strong><span>{request.status === 'RECEIVED' ? t('workflow.documentStatusReceived') : t('workflow.documentStatusRequested')}</span></li>)}</ul> : <p>{t('workflow.noDocumentRequests')}</p>}</section>
    <section className={styles.preview} aria-labelledby="panel-activity"><h3 id="panel-activity">{t('workflow.recentActivity')}</h3>{detail.activity.length ? <ol>{detail.activity.slice(0, 3).map((entry, index) => <li key={`${entry.occurredAt}-${index}`}>{entry.action.replaceAll('.', ' ')}</li>)}</ol> : <p>{t('workflow.noActivity')}</p>}</section>
  </aside>
}
