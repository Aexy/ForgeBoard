'use client'

import { useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useGetEngagementChecklistQuery, useToggleEngagementChecklistItemMutation } from './engagements-transport'
import styles from './EngagementChecklist.module.css'

export function EngagementChecklist({ engagementId }: Readonly<{ engagementId: string }>) {
  const firm = useFirmContext()
  const checklist = useGetEngagementChecklistQuery({ firm, engagementId })
  const [toggle, toggleResult] = useToggleEngagementChecklistItemMutation()
  const [error, setError] = useState('')
  if (checklist.isLoading) return <p aria-live="polite">Loading checklist…</p>
  if (checklist.isError) return <p role="alert">The checklist could not be loaded.</p>
  const items = checklist.data ?? []
  const complete = items.filter((item) => item.completed).length
  const update = async (itemId: string, completed: boolean, expectedVersion: number) => {
    setError('')
    try {
      await toggle({ firm, engagementId, checklistItemId: itemId, completed, expectedVersion }).unwrap()
    } catch {
      await checklist.refetch()
      setError('The checklist changed while you were updating it. The latest status has been restored.')
    }
  }
  return <section className={styles.checklist} aria-labelledby={`engagement-checklist-${engagementId}`}>
    <header><h2 id={`engagement-checklist-${engagementId}`}>Engagement checklist</h2><p>{complete} of {items.length} complete</p></header>
    {items.length === 0 ? <p>No checklist items were included in this template version.</p> : <ul>{items.map((item) => <li key={item.id}>
      <label><input type="checkbox" checked={item.completed} disabled={!item.canUpdate || toggleResult.isLoading} onChange={(event) => void update(item.id, event.target.checked, item.version)} /><span>{item.label}</span>{item.required && <em>Required</em>}</label>
      {!item.canUpdate && <span className={styles.readOnly}>Only the assigned preparer can update this checklist.</span>}
    </li>)}</ul>}
    {error && <p role="alert">{error}</p>}
  </section>
}
