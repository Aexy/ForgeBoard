export type Recurrence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export type EngagementStatus = 'OPEN' | 'COMPLETE' | 'CANCELLED'

export type EngagementTemplate = {
  id: string
  name: string
  workflowId: string
  recurrence: Recurrence
  defaultWorkItemTitle: string
  dueDay: number
  version: number
}

export type Engagement = {
  id: string
  templateId: string
  clientId: string
  workflowId: string
  workItemId: string | null
  periodStart: string
  periodEnd: string
  dueDate: string
  status: EngagementStatus
  version: number
}

type Csrf = { headerName: string; token: string }
type Problem = { detail?: string }

export class EngagementApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'EngagementApiError'
  }
}

async function request<T>(firmId: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'X-ForgeBoard-Firm': firmId, ...init?.headers },
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as Problem | null
    throw new EngagementApiError(response.status, problem?.detail ?? `ForgeBoard request failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function mutate<T>(firmId: string, path: string, method: string, body: unknown): Promise<T> {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!csrfResponse.ok) throw new EngagementApiError(csrfResponse.status, 'Could not establish a secure session')
  const csrf = await csrfResponse.json() as Csrf
  return request<T>(firmId, path, {
    method,
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(body),
  })
}

export const listEngagements = (firmId: string) => request<Engagement[]>(firmId, '/api/engagements')
export const listEngagementTemplates = (firmId: string) => request<EngagementTemplate[]>(firmId, '/api/engagements/templates')
export const createEngagementTemplate = (firmId: string, details: Omit<EngagementTemplate, 'id' | 'version'>) =>
  mutate<EngagementTemplate>(firmId, '/api/engagements/templates', 'POST', details)
export const createEngagementInstance = (firmId: string, templateId: string, details: { clientId: string; periodStart: string }) =>
  mutate<Engagement>(firmId, `/api/engagements/templates/${templateId}/instances`, 'POST', details)
