'use client'

import { useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { type RecurrenceFailure, useGenerateRecurrenceFailureMutation, useGetRecurrenceFailuresQuery, useMarkRecurrenceFailureSolvedMutation, useRetryRecurrenceFailureMutation } from './engagements-transport'
import styles from './Engagements.module.css'

/** Owners alone can acknowledge or recover an automated generation incident. */
export function RecurrenceFailurePanel() {
  const firm = useFirmContext()
  const failures = useGetRecurrenceFailuresQuery({ firm }, { skip: firm.role !== 'OWNER' })
  const [retry, retryResult] = useRetryRecurrenceFailureMutation()
  const [markSolved] = useMarkRecurrenceFailureSolvedMutation()
  const [generate, generateResult] = useGenerateRecurrenceFailureMutation()
  const [openRun, setOpenRun] = useState<string | null>(null)
  const [error, setError] = useState('')
  if (firm.role !== 'OWNER' || failures.isLoading || failures.isError || !failures.data?.length) return null
  async function recover(action: () => { unwrap: () => Promise<unknown> }) { setError(''); try { await action().unwrap() } catch { setError('The recurrence failure could not be updated. Refresh and try again.') } }
  return <section className={styles.failurePanel} aria-labelledby="recurrence-failures-heading">
    <div><h2 id="recurrence-failures-heading">Recurring generation needs attention</h2><p>Each incident is retained until it is recovered or marked solved.</p></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {failures.data.map((failure: RecurrenceFailure) => <article key={failure.id} className={styles.failureRow}>
      <div><h3>{failure.templateName}</h3><p>Period starting {failure.periodStart}. {failure.failureDetail}</p>{failure.generateNowDisabled && <p className={styles.notice}>Retry once before generating from the updated template definition.</p>}</div>
      <div className={styles.recoveryActions}>
        <div className={styles.splitButton}><button type="button" onClick={() => void recover(() => retry({ firm, runId: failure.id }))} disabled={retryResult.isLoading}>Retry once</button><button type="button" className={styles.splitToggle} aria-label={`More recovery actions for ${failure.templateName}`} aria-expanded={openRun === failure.id} onClick={() => setOpenRun(openRun === failure.id ? null : failure.id)}>▾</button>{openRun === failure.id && <div className={styles.recoveryMenu}><button type="button" onClick={() => void recover(() => markSolved({ firm, runId: failure.id }))}>Mark solved</button></div>}</div>
        <button type="button" onClick={() => void recover(() => generate({ firm, runId: failure.id }))} disabled={failure.generateNowDisabled || generateResult.isLoading} title={failure.generateNowDisabled ? 'Retry once before generating from the updated template definition.' : undefined}>Generate now</button>
      </div>
    </article>)}
  </section>
}
