export type WorkPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type WorkItem = { id: string; clientId: string; stageId: string; title: string; description: string; dueDate: string | null; priority: WorkPriority; rank: number; version: number }
export type WorkflowStage = { id: string; name: string; position: number; items: WorkItem[] }
export type WorkflowBoard = { id: string; name: string; stages: WorkflowStage[] }
export type WorkflowSummary = { id: string; name: string }
type Csrf = { headerName: string; token: string }

async function request<T>(firmId: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'X-ForgeBoard-Firm': firmId, ...init?.headers } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<T>
}
async function mutate<T>(firmId: string, path: string, method: string, body: unknown) {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!csrfResponse.ok) throw new Error(`ForgeBoard request failed with ${csrfResponse.status}`)
  const csrf = await csrfResponse.json() as Csrf
  return request<T>(firmId, path, { method, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify(body) })
}
export const listWorkflows = (firmId: string) => request<WorkflowSummary[]>(firmId, '/api/workflows')
export const getWorkflow = (firmId: string, id: string) => request<WorkflowBoard>(firmId, `/api/workflows/${id}`)
export const createWorkflow = (firmId: string, details: { name: string; stages: string[] }) => mutate<WorkflowBoard>(firmId, '/api/workflows', 'POST', details)
export const createWorkItem = (firmId: string, workflowId: string, details: { clientId: string; stageId: string; title: string; description: string; dueDate: string | null; priority: WorkPriority }) => mutate<WorkItem>(firmId, `/api/workflows/${workflowId}/items`, 'POST', details)
export const moveWorkItem = (firmId: string, workflowId: string, itemId: string, targetStageId: string, expectedVersion: number) => mutate<WorkItem>(firmId, `/api/workflows/${workflowId}/items/${itemId}/position`, 'PATCH', { targetStageId, beforeItemId: null, afterItemId: null, expectedVersion })
