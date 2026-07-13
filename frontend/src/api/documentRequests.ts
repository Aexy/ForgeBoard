export type DocumentRequestStatus = 'REQUESTED' | 'RECEIVED'
export type DocumentRequest = { id: string; clientId: string; label: string; externalReference: string | null; dueDate: string | null; status: DocumentRequestStatus; receivedAt: string | null; version: number }
export type NewDocumentRequest = { clientId: string; label: string; externalReference: string; dueDate: string | null }
type Csrf = { headerName: string; token: string }

async function request<T>(firmId: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'X-ForgeBoard-Firm': firmId, ...init?.headers } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<T>
}
async function mutate<T>(firmId: string, path: string, method: string, body?: unknown): Promise<T> {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!csrfResponse.ok) throw new Error(`ForgeBoard request failed with ${csrfResponse.status}`)
  const csrf = await csrfResponse.json() as Csrf
  return request<T>(firmId, path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), [csrf.headerName]: csrf.token }, ...(body ? { body: JSON.stringify(body) } : {}) })
}

export const listDocumentRequests = (firmId: string) => request<DocumentRequest[]>(firmId, '/api/document-requests')
export const createDocumentRequest = (firmId: string, details: NewDocumentRequest) => mutate<DocumentRequest>(firmId, '/api/document-requests', 'POST', details)
export const markDocumentRequestReceived = (firmId: string, requestId: string) => mutate<DocumentRequest>(firmId, `/api/document-requests/${requestId}/received`, 'PATCH')
