import { notFound, redirect } from 'next/navigation'

import { WorkflowBoard } from '@/features/workflow/WorkflowBoard'
import { isUuidRouteValue, publicTaskForLegacyIds, publicWorkflowForLegacyId } from '@/lib/legacy-workflow-route'
import { canonicalBoardQuery, isCanonicalBoardQuery } from '@/features/workflow/workflow-route-state'

export default async function WorkflowPage({ params, searchParams }: Readonly<{ params: Promise<{ firmSlug: string; workflowId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const { firmSlug, workflowId: workflowSlug } = await params
  if (isUuidRouteValue(workflowSlug)) {
    const workflow = await publicWorkflowForLegacyId(firmSlug, workflowSlug)
    if (!workflow) notFound()
    const legacyQuery = await searchParams
    const legacyTask = typeof legacyQuery.task === 'string' ? legacyQuery.task : undefined
    const task = legacyTask && isUuidRouteValue(legacyTask)
      ? await publicTaskForLegacyIds(firmSlug, workflowSlug, legacyTask)
      : undefined
    const query = canonicalBoardQuery(legacyQuery, task?.item.taskReference)
    redirect(`/firms/${firmSlug}/workflow/${workflow.workflowSlug}${query.size ? `?${query}` : ''}`)
  }
  const query = await searchParams
  if (!isCanonicalBoardQuery(query)) {
    const canonicalQuery = canonicalBoardQuery(query)
    redirect(`/firms/${firmSlug}/workflow/${workflowSlug}${canonicalQuery.size ? `?${canonicalQuery}` : ''}`)
  }
  return <WorkflowBoard workflowSlug={workflowSlug} basePath={`/firms/${firmSlug}/workflow/${workflowSlug}`} />
}
