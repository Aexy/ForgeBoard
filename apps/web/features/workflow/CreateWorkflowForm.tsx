'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
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

export function CreateWorkflowForm({ triggerLabel }: Readonly<{ triggerLabel?: string }>) {
  const firm = useFirmContext()
  const router = useRouter()
  const [createWorkflow, creation] = useCreateWorkflowMutation()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const { t } = useLanguage()

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
      setError(t('workflow.createError'))
    }
  }

  return <div className={styles.creator}>
    <button type="button" className={styles.trigger} onClick={() => setShowForm((open) => !open)}>{showForm ? t('common.cancel') : triggerLabel ?? t('workflow.newWorkflow')}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {showForm && <form className={styles.form} onSubmit={submit}>
      <h2>{t('workflow.newWorkflow')}</h2>
      <label>{t('workflow.workflowName')}<input name="name" required maxLength={160} autoFocus /></label>
      <div className={styles.stages}>{defaultStages.map((stage, index) => <fieldset key={stage.name}><legend>{t('workflow.stage')} {index + 1}</legend><label>{t('workflow.name')}<input name={`stage-${index}-name`} required={index < 2} maxLength={120} defaultValue={stage.name} /></label><label>{t('workflow.attention')}<select name={`stage-${index}-attention`} defaultValue={stage.attention}><option value="NONE">{t('workflow.normalFlow')}</option><option value="BLOCKED">{t('workflow.blocked')}</option><option value="AWAITING_REVIEW">{t('workflow.awaitingReview')}</option></select></label></fieldset>)}</div>
      <button type="submit" className={styles.submit} disabled={creation.isLoading}>{creation.isLoading ? t('workflow.creatingWorkflow') : t('workflow.createWorkflow')}</button>
    </form>}
  </div>
}
