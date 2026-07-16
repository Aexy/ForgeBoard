import { TaskWorkspace } from '@/features/workflow/TaskWorkspace'

export default async function TaskPage({ params }: Readonly<{ params: Promise<{ workflowId: string; taskId: string }> }>) {
  const { workflowId, taskId } = await params
  return <TaskWorkspace workflowId={workflowId} taskId={taskId} />
}
