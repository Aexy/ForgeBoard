'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { type CreateWorkflowDetails, type StageAttention, useCreateWorkflowMutation, useGetWorkflowsQuery } from './workflow-transport'

import styles from './WorkflowHub.module.css'

const defaultStages: CreateWorkflowDetails['stages'] = [
  { name: 'Waiting on client', attention: 'NONE' },
  { name: 'In preparation', attention: 'NONE' },
  { name: 'Ready for review', attention: 'AWAITING_REVIEW' },
  { name: 'Complete', attention: 'NONE' },
]

function workflowPath(firmSlug: string, workflowSlug: string) {
  return `/firms/${firmSlug}/workflow/${workflowSlug}`
}

export function WorkflowHub() {
  const firm = useFirmContext()
  const router = useRouter()
  const workflows = useGetWorkflowsQuery({ firm })
  const [createWorkflow, creation] = useCreateWorkflowMutation()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const canCreate = firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR'

  useEffect(() => {
    const firstWorkflow = workflows.data?.[0]
    if (firstWorkflow) router.replace(workflowPath(firm.firmSlug, firstWorkflow.workflowSlug))
  }, [firm.firmSlug, router, workflows.data])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const stages = defaultStages.map((stage, index) => ({
      name: String(data.get(`stage-${index}-name`) ?? '').trim(),
      attention: String(data.get(`stage-${index}-attention`)) as StageAttention,
    })).filter((stage) => stage.name)
    setError('')
    try {
      const created = await createWorkflow({
        firm,
        details: { name: String(data.get('name') ?? '').trim(), stages },
      }).unwrap()
      router.push(workflowPath(firm.firmSlug, created.workflowSlug))
    } catch {
      setError('The workflow could not be created. Use at least two named stages.')
    }
  }

  if (workflows.isLoading) return <p aria-live="polite">Loading workflows…</p>
  if (workflows.isError) return <p role="alert">Workflows could not be loaded. Please refresh and try again.</p>
  if (workflows.data?.length) return <section className={styles.workspace} aria-live="polite"><p>Opening {workflows.data[0].name}…</p></section>

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Client work</p><h1>No workflow yet</h1><p>Create the stages your firm uses to move client work from request through review.</p></div>
      {canCreate && <button type="button" onClick={() => setShowForm((open) => !open)}>{showForm ? 'Cancel' : 'Create workflow'}</button>}
    </header>
    {!canCreate && <p className={styles.notice}>Only firm owners and administrators can create workflows.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {canCreate && showForm && <form className={styles.form} onSubmit={submit}>
      <h2>New workflow</h2>
      <label>Workflow name<input name="name" required maxLength={160} autoFocus /></label>
      <div className={styles.stages}>{defaultStages.map((stage, index) => <fieldset key={stage.name}><legend>Stage {index + 1}</legend><label>Name<input name={`stage-${index}-name`} required={index < 2} maxLength={120} defaultValue={stage.name} /></label><label>Attention<select name={`stage-${index}-attention`} defaultValue={stage.attention}><option value="NONE">Normal flow</option><option value="BLOCKED">Blocked</option><option value="AWAITING_REVIEW">Awaiting review</option></select></label></fieldset>)}</div>
      <button type="submit" disabled={creation.isLoading}>{creation.isLoading ? 'Creating workflow…' : 'Create workflow'}</button>
    </form>}
  </section>
}
