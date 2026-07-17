import { notFound, redirect } from 'next/navigation'

import { TaskWorkspace } from '@/features/workflow/TaskWorkspace'
import { isUuidRouteValue, publicTaskForLegacyIds, publicWorkflowForLegacyId } from '@/lib/legacy-workflow-route'

export default async function TaskPage({ params }: Readonly<{ params: Promise<{ firmSlug: string; workflowId: string; taskId: string }> }>) {
  const { firmSlug, workflowId: workflowSlug, taskId: taskReference } = await params
  if (isUuidRouteValue(workflowSlug) || isUuidRouteValue(taskReference)) {
    if (!isUuidRouteValue(workflowSlug) || !isUuidRouteValue(taskReference)) notFound()
    const [workflow, task] = await Promise.all([
      publicWorkflowForLegacyId(firmSlug, workflowSlug),
      publicTaskForLegacyIds(firmSlug, workflowSlug, taskReference),
    ])
    if (!workflow || !task) notFound()
    redirect(`/firms/${firmSlug}/workflow/${workflow.workflowSlug}/tasks/${task.item.taskReference}`)
  }
  return <TaskWorkspace workflowSlug={workflowSlug} taskReference={taskReference} workflowPath={`/firms/${firmSlug}/workflow/${workflowSlug}`} />
}
