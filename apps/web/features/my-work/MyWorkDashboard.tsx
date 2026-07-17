'use client'

import Link from 'next/link'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { type EmployeeWorkItem, useGetMyWorkQuery } from '@/store/api'

import styles from './MyWorkDashboard.module.css'

function WorkGroup({ firmSlug, title, items }: Readonly<{ firmSlug: string; title: string; items: EmployeeWorkItem[] }>) {
  return <section className={styles.group}><header><h2>{title}</h2><span>{items.length}</span></header>{items.length === 0 ? <p>No work items.</p> : items.map((item) => <Link className={styles.card} href={`/firms/${firmSlug}/workflow/${item.workflowSlug}/tasks/${item.taskReference}`} key={item.taskReference}><h3>{item.title}</h3><p>{item.stageName}{item.dueDate ? ` · Due ${item.dueDate}` : ''}</p></Link>)}</section>
}

export function MyWorkDashboard() {
  const firm = useFirmContext(); const dashboard = useGetMyWorkQuery({ firm })
  return <section className={styles.workspace}><header><p className={styles.eyebrow}>Personal work queue</p><h1>My work</h1><p>Only work assigned to you in this firm is shown here.</p></header>{dashboard.isError ? <p className={styles.error} role="alert">Your assigned work could not be loaded.</p> : dashboard.isLoading || !dashboard.data ? <p aria-live="polite">Loading your work…</p> : <div className={styles.board} aria-label="My assigned work"><WorkGroup firmSlug={firm.firmSlug} title="Overdue" items={dashboard.data.overdue} /><WorkGroup firmSlug={firm.firmSlug} title="Due soon" items={dashboard.data.dueSoon} /><WorkGroup firmSlug={firm.firmSlug} title="Blocked" items={dashboard.data.blocked} /><WorkGroup firmSlug={firm.firmSlug} title="Awaiting review" items={dashboard.data.awaitingReview} /><WorkGroup firmSlug={firm.firmSlug} title="Active" items={dashboard.data.active} /></div>}</section>
}
