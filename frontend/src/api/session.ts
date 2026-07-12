export type SessionIdentity = { email: string }
export type FirmOnboarding = {
  firmName: string
  firmSlug: string
  ownerEmail: string
  ownerName: string
  password: string
}
export type OnboardingResult = { firmId: string; firmSlug: string; ownerId: string; ownerEmail: string }
type CsrfToken = { headerName: string; token: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function login(email: string, password: string): Promise<SessionIdentity> {
  return request<CsrfToken>('/api/auth/csrf').then((csrf) => request('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify({ email, password }),
  }))
}

export function currentSession(): Promise<SessionIdentity> {
  return request('/api/auth/session')
}

export function createFirm(details: FirmOnboarding): Promise<OnboardingResult> {
  return request('/api/onboarding/firms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  })
}

export async function logout(): Promise<void> {
  const csrf = await request<CsrfToken>('/api/auth/csrf')
  return request('/api/auth/session', { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } })
}
