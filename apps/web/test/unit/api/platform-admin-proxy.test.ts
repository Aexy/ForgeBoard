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

import { GET, POST } from '@/app/api/platform-admin/[...path]/route'

const session = {
  user: { id: 'platform-admin-1', email: 'owner@example.com' },
  firms: [],
  platformAdministrator: true,
}
const apiSession = { ...session, accessToken: 'private-access-token', refreshToken: 'private-refresh-token', accessTokenExpiresAt: Date.now() + 60_000 }
const routeContext = { params: Promise.resolve({ path: ['firms'] }) }

function request(method = 'GET', options: RequestInit = {}) {
  return new Request('http://localhost:3000/api/platform-admin/firms?query=hearth', { method, ...options })
}

describe('platform administration BFF proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_SECRET', 'a test-only secret with sufficient length')
    vi.stubEnv('AUTH_URL', 'http://localhost:3000')
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubEnv('FORGEBOARD_TOKEN_ISSUER', 'forgeboard')
    vi.stubEnv('FORGEBOARD_PUBLIC_ORIGIN', 'http://localhost:3000')
    vi.stubEnv('NODE_ENV', 'test')
    mocks.auth.mockResolvedValue(session)
    mocks.apiSessionFromRequest.mockResolvedValue(apiSession)
    mocks.upstreamResponse.mockResolvedValue(new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Total-Count': '0',
        'Set-Cookie': 'JSESSIONID=private',
        Authorization: 'Bearer must-not-reach-browser',
      },
    }))
  })

  it('returns 401 for anonymous and refresh-failed sessions', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(request(), routeContext)).status).toBe(401)

    mocks.auth.mockResolvedValue({ ...session, error: 'RefreshAccessTokenError' })
    expect((await GET(request(), routeContext)).status).toBe(401)
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('returns 403 for a signed-in user without the platform capability', async () => {
    mocks.auth.mockResolvedValue({ ...session, platformAdministrator: false })

    expect((await GET(request(), routeContext)).status).toBe(403)
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('proxies platform calls for a firmless platform admin without tenant context or credential leaks', async () => {
    const response = await GET(request(), routeContext)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
    expect(mocks.upstreamResponse).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/platform-admin/firms?query=hearth',
      method: 'GET',
    }))
    const forwarded = mocks.upstreamResponse.mock.calls[0][0]
    expect(forwarded.firmId).toBeUndefined()
    expect(new Headers(forwarded.headers).get('cookie')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('authorization')).toBeNull()
    expect(JSON.stringify(response)).not.toContain('private-access-token')
    expect(JSON.stringify(response)).not.toContain('private-refresh-token')
  })

  it('rejects cross-origin mutations before authorization or backend access', async () => {
    const response = await POST(request('POST', { headers: { Origin: 'https://attacker.example' }, body: '{}' }), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('forwards a same-origin mutation body without browser credentials', async () => {
    const response = await POST(request('POST', {
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hearth Accounting' }),
    }), routeContext)

    expect(response.status).toBe(200)
    const forwarded = mocks.upstreamResponse.mock.calls[0][0]
    expect(new TextDecoder().decode(forwarded.body)).toBe('{"name":"Hearth Accounting"}')
  })
})
