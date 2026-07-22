'use client'

import Link from 'next/link'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
import { type EmployeeWorkItem, useGetMyWorkQuery } from './my-work-transport'

import styles from './MyWorkDashboard.module.css'

function WorkGroup({ firmSlug, title, items }: Readonly<{ firmSlug: string; title: string; items: EmployeeWorkItem[] }>) {
  const { t } = useLanguage()
  return <section className={styles.group}><header><h2>{title}</h2><span>{items.length}</span></header>{items.length === 0 ? <p>{t('myWork.noWorkItems')}</p> : items.map((item) => <Link className={styles.card} href={`/firms/${firmSlug}/workflow/${item.workflowSlug}/tasks/${item.taskReference}`} key={item.taskReference}><h3>{item.title}</h3><p>{item.stageName}{item.dueDate ? ` · ${t('myWork.due')} ${item.dueDate}` : ''}</p></Link>)}</section>
}

export function MyWorkDashboard() {
  const { t } = useLanguage()
  const firm = useFirmContext(); const dashboard = useGetMyWorkQuery({ firm })
  return <section className={styles.workspace}><header><p className={styles.eyebrow}>{t('myWork.eyebrow')}</p><h1>{t('myWork.title')}</h1><p>{t('myWork.description')}</p></header>{dashboard.isError ? <p className={styles.error} role="alert">{t('myWork.loadError')}</p> : dashboard.isLoading || !dashboard.data ? <p aria-live="polite">{t('myWork.loading')}</p> : <div className={styles.board} aria-label={t('myWork.assignedWork')}><WorkGroup firmSlug={firm.firmSlug} title={t('myWork.overdue')} items={dashboard.data.overdue} /><WorkGroup firmSlug={firm.firmSlug} title={t('myWork.dueSoon')} items={dashboard.data.dueSoon} /><WorkGroup firmSlug={firm.firmSlug} title={t('myWork.blocked')} items={dashboard.data.blocked} /><WorkGroup firmSlug={firm.firmSlug} title={t('myWork.awaitingReview')} items={dashboard.data.awaitingReview} /><WorkGroup firmSlug={firm.firmSlug} title={t('myWork.active')} items={dashboard.data.active} /></div>}</section>
}
