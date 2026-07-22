'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
import { CreateWorkflowForm } from './CreateWorkflowForm'
import { useGetWorkflowsQuery } from './workflow-transport'

import styles from './WorkflowHub.module.css'

function workflowPath(firmSlug: string, workflowSlug: string) {
  return `/firms/${firmSlug}/workflow/${workflowSlug}`
}

export function WorkflowHub() {
  const firm = useFirmContext()
  const router = useRouter()
  const workflows = useGetWorkflowsQuery({ firm })
  const { t } = useLanguage()
  const canManageWorkflows = firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR' || firm.role === 'MANAGER'

  useEffect(() => {
    const firstWorkflow = workflows.data?.[0]
    if (firstWorkflow) router.replace(workflowPath(firm.firmSlug, firstWorkflow.workflowSlug))
  }, [firm.firmSlug, router, workflows.data])

  if (workflows.isLoading) return <p aria-live="polite">{t('workflow.loadingWorkflows')}</p>
  if (workflows.isError) return <p role="alert">{t('workflow.loadWorkflowsError')}</p>
  if (workflows.data?.length) return <section className={styles.workspace} aria-live="polite"><p>{t('workflow.opening')} {workflows.data[0].name}…</p></section>

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{t('workflow.clientWork')}</p><h1>{t('workflow.noWorkflow')}</h1><p>{t('workflow.description')}</p></div>
      <CreateWorkflowForm triggerLabel={t('workflow.createWorkflow')} />
    </header>
    {!canManageWorkflows && <p className={styles.notice}>{t('workflow.onlyManagersCreate')}</p>}
  </section>
}
