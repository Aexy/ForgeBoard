export type ClientStatus = 'ACTIVE' | 'ARCHIVED'
export type Client = { id: string; legalName: string; displayName: string; primaryEmail: string | null; status: ClientStatus; version: number }
export type ClientDetails = { legalName: string; displayName: string; primaryEmail: string }
type CsrfToken = { headerName: string; token: string }

async function request<T>(firmId: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'X-ForgeBoard-Firm': firmId, ...init?.headers } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<T>
}
async function csrf(): Promise<CsrfToken> {
  const response = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<CsrfToken>
}
export const listClients = (firmId: string) => request<Client[]>(firmId, '/api/clients')
export async function createClient(firmId: string, details: ClientDetails) {
  const token = await csrf()
  return request<Client>(firmId, '/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json', [token.headerName]: token.token }, body: JSON.stringify(details) })
}
export async function archiveClient(firmId: string, clientId: string) {
  const token = await csrf()
  return request<Client>(firmId, `/api/clients/${clientId}/archive`, { method: 'PATCH', headers: { [token.headerName]: token.token } })
}
