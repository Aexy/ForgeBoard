import { WorkflowBoard } from '@/features/workflow/WorkflowBoard'

export default async function WorkflowPage({ params }: Readonly<{ params: Promise<{ firmSlug: string; workflowId: string }> }>) {
  const { firmSlug, workflowId } = await params
  return <WorkflowBoard workflowId={workflowId} basePath={`/firms/${firmSlug}/workflow/${workflowId}`} />
}
