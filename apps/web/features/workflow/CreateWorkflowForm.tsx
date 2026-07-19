'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { type CreateWorkflowDetails, type StageAttention, useCreateWorkflowMutation } from './workflow-transport'

import styles from './CreateWorkflowForm.module.css'

const defaultStages: CreateWorkflowDetails['stages'] = [
  { name: 'Waiting on client', attention: 'NONE' },
  { name: 'In preparation', attention: 'NONE' },
  { name: 'Ready for review', attention: 'AWAITING_REVIEW' },
  { name: 'Complete', attention: 'NONE' },
]

function canManageWorkflows(role: string) {
  return role === 'OWNER' || role === 'ADMINISTRATOR' || role === 'MANAGER'
}

export function CreateWorkflowForm({ triggerLabel = 'New workflow' }: Readonly<{ triggerLabel?: string }>) {
  const firm = useFirmContext()
  const router = useRouter()
  const [createWorkflow, creation] = useCreateWorkflowMutation()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  if (!canManageWorkflows(firm.role)) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const stages = defaultStages.map((stage, index) => ({
      name: String(data.get(`stage-${index}-name`) ?? '').trim(),
      attention: String(data.get(`stage-${index}-attention`)) as StageAttention,
    })).filter((stage) => stage.name)
    setError('')
    try {
      const created = await createWorkflow({ firm, details: { name: String(data.get('name') ?? '').trim(), stages } }).unwrap()
      router.push(`/firms/${firm.firmSlug}/workflow/${created.workflowSlug}`)
    } catch {
      setError('The workflow could not be created. Use at least two named stages.')
    }
  }

  return <div className={styles.creator}>
    <button type="button" className={styles.trigger} onClick={() => setShowForm((open) => !open)}>{showForm ? 'Cancel' : triggerLabel}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {showForm && <form className={styles.form} onSubmit={submit}>
      <h2>New workflow</h2>
      <label>Workflow name<input name="name" required maxLength={160} autoFocus /></label>
      <div className={styles.stages}>{defaultStages.map((stage, index) => <fieldset key={stage.name}><legend>Stage {index + 1}</legend><label>Name<input name={`stage-${index}-name`} required={index < 2} maxLength={120} defaultValue={stage.name} /></label><label>Attention<select name={`stage-${index}-attention`} defaultValue={stage.attention}><option value="NONE">Normal flow</option><option value="BLOCKED">Blocked</option><option value="AWAITING_REVIEW">Awaiting review</option></select></label></fieldset>)}</div>
      <button type="submit" className={styles.submit} disabled={creation.isLoading}>{creation.isLoading ? 'Creating workflow…' : 'Create workflow'}</button>
    </form>}
  </div>
}
