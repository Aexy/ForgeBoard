export type MembershipRole = 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER' | 'READ_ONLY'
export type Employee = { membershipId: string; userId: string; displayName: string; email: string; role: MembershipRole }
export type CreateEmployeeRequest = { displayName: string; email: string; temporaryPassword: string; role: MembershipRole }
type Csrf = { headerName: string; token: string }

async function request<T>(firmId: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'X-ForgeBoard-Firm': firmId, ...init?.headers } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<T>
}
async function mutate<T>(firmId: string, path: string, method: string, body: unknown): Promise<T> {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!csrfResponse.ok) throw new Error(`ForgeBoard request failed with ${csrfResponse.status}`)
  const csrf = await csrfResponse.json() as Csrf
  return request<T>(firmId, path, { method, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify(body) })
}
export const employeeDirectoryKey = (firmId: string) => ['employees', firmId] as const
export const listEmployees = (firmId: string) => request<Employee[]>(firmId, '/api/identity/employees')
export const createEmployee = (firmId: string, request: CreateEmployeeRequest) => mutate<Employee>(firmId, '/api/identity/employees', 'POST', request)
