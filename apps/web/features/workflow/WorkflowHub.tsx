'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useFirmContext } from '@/store/firm-cache-boundary'
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
  const canManageWorkflows = firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR' || firm.role === 'MANAGER'

  useEffect(() => {
    const firstWorkflow = workflows.data?.[0]
    if (firstWorkflow) router.replace(workflowPath(firm.firmSlug, firstWorkflow.workflowSlug))
  }, [firm.firmSlug, router, workflows.data])

  if (workflows.isLoading) return <p aria-live="polite">Loading workflows…</p>
  if (workflows.isError) return <p role="alert">Workflows could not be loaded. Please refresh and try again.</p>
  if (workflows.data?.length) return <section className={styles.workspace} aria-live="polite"><p>Opening {workflows.data[0].name}…</p></section>

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Client work</p><h1>No workflow yet</h1><p>Create the stages your firm uses to move client work from request through review.</p></div>
      <CreateWorkflowForm triggerLabel="Create workflow" />
    </header>
    {!canManageWorkflows && <p className={styles.notice}>Only firm owners, administrators, and managers can create workflows.</p>}
  </section>
}
