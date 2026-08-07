import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  apiSessionFromRequest: vi.fn(),
  upstreamResponse: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth-session', () => ({ apiSessionFromRequest: mocks.apiSessionFromRequest }))
vi.mock('@forgeboard/api-client/server', () => ({
  serverApi: () => ({ response: mocks.upstreamResponse }),
}))

import { POST as acceptNew, PUT as acceptExisting } from '@/app/api/forgeboard/access/invitations/[token]/route'
import { POST as completeReset } from '@/app/api/forgeboard/access/password-resets/[token]/route'

const session = {
  user: { id: 'member-1', email: 'member@example.com' },
  firms: [],
  platformAdministrator: false,
}
const apiSession = {
  ...session,
  accessToken: 'private-access-token',
  refreshToken: 'private-refresh-token',
  accessTokenExpiresAt: Date.now() + 60_000,
}
const invitationContext = { params: Promise.resolve({ token: 'invite-token' }) }
const resetContext = { params: Promise.resolve({ token: 'reset-token' }) }

function request(path: string, method = 'POST', options: RequestInit = {}) {
  return new Request(`http://localhost:3000${path}`, { method, ...options })
}

describe('access action BFF proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_SECRET', 'a test-only secret with sufficient length')
    vi.stubEnv('AUTH_URL', 'http://localhost:3000')
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubEnv('FORGEBOARD_TOKEN_ISSUER', 'forgeboard')
    vi.stubEnv('FORGEBOARD_PUBLIC_ORIGIN', 'http://localhost:3000')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubGlobal('fetch', vi.fn())
    mocks.auth.mockResolvedValue(session)
    mocks.apiSessionFromRequest.mockResolvedValue(apiSession)
    mocks.upstreamResponse.mockResolvedValue(new Response(JSON.stringify({ completed: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'JSESSIONID=private',
        Authorization: 'Bearer must-not-reach-browser',
        'X-Correlation-Id': 'request-1',
      },
    }))
  })

  it('proxies public new-account acceptance with an exact upstream path and no credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ completed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'JSESSIONID=private', Authorization: 'Bearer private' },
    }))

    const response = await acceptNew(request('/api/forgeboard/access/invitations/invite-token', 'POST', {
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', Cookie: 'browser=private' },
      body: JSON.stringify({ displayName: 'New member', password: 'correct horse battery' }),
    }), invitationContext)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ completed: true })
    expect(fetch).toHaveBeenCalledWith('http://spring:8080/api/access/invitations/invite-token/accept-new', expect.objectContaining({ method: 'POST' }))
    const upstreamOptions = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
    expect(new Headers(upstreamOptions.headers).get('cookie')).toBeNull()
    expect(new Headers(upstreamOptions.headers).get('authorization')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('authorization')).toBeNull()
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('proxies public password reset completion with no Spring credential or cookie forwarding', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204, headers: { 'Set-Cookie': 'JSESSIONID=private' } }))

    const response = await completeReset(request('/api/forgeboard/access/password-resets/reset-token', 'POST', {
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct horse battery' }),
    }), resetContext)

    expect(response.status).toBe(204)
    expect(fetch).toHaveBeenCalledWith('http://spring:8080/api/access/password-resets/reset-token/complete', expect.objectContaining({ method: 'POST' }))
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects public cross-origin mutations before invoking Spring', async () => {
    const response = await acceptNew(request('/api/forgeboard/access/invitations/invite-token', 'POST', {
      headers: { Origin: 'https://attacker.example' }, body: '{}',
    }), invitationContext)

    expect(response.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('uses the Auth.js bearer session for existing-account acceptance without firm context', async () => {
    const response = await acceptExisting(request('/api/forgeboard/access/invitations/invite-token', 'PUT', {
      headers: { Origin: 'http://localhost:3000' },
    }), invitationContext)

    expect(response.status).toBe(200)
    expect(mocks.upstreamResponse).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/access/invitations/invite-token/accept-existing', method: 'POST',
    }))
    const forwarded = mocks.upstreamResponse.mock.calls[0][0]
    expect(forwarded.firmId).toBeUndefined()
    expect(new Headers(forwarded.headers).get('cookie')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('authorization')).toBeNull()
  })

  it('rejects unauthenticated existing-account acceptance before Spring', async () => {
    mocks.auth.mockResolvedValue(null)

    const response = await acceptExisting(request('/api/forgeboard/access/invitations/invite-token', 'PUT', {
      headers: { Origin: 'http://localhost:3000' },
    }), invitationContext)

    expect(response.status).toBe(401)
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })
})
