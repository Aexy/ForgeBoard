export type SessionIdentity = { email: string }
type CsrfToken = { headerName: string; token: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function login(email: string, password: string): Promise<SessionIdentity> {
  return request('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export function currentSession(): Promise<SessionIdentity> {
  return request('/api/auth/session')
}

export async function logout(): Promise<void> {
  const csrf = await request<CsrfToken>('/api/auth/csrf')
  return request('/api/auth/session', { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } })
}

