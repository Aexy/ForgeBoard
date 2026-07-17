import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiSessionFromRequest: vi.fn(),
  auth: vi.fn(),
  upstreamResponse: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth-session', () => ({ apiSessionFromRequest: mocks.apiSessionFromRequest }))
vi.mock('@forgeboard/api-client/server', () => ({
  serverApi: () => ({ response: mocks.upstreamResponse }),
}))

import { GET, POST } from '@/app/api/forgeboard/[...path]/route'
import { POST as selectFirmContext } from '@/app/api/forgeboard/firm-context/route'
import { createFirmContextValue } from '@/lib/firm-context-cookie'

const session = {
  user: { id: 'user-1', email: 'owner@example.com' },
  firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth Accounting', role: 'OWNER' as const }],
}
const apiSession = { ...session, accessToken: 'private-access-token', refreshToken: 'private-refresh-token', accessTokenExpiresAt: Date.now() + 60_000 }
const routeContext = { params: Promise.resolve({ path: ['workflows', 'workflow-1'] }) }

async function request(method = 'GET', options: RequestInit = {}) {
  const headers = new Headers({
    Cookie: `forgeboard-firm-context=${await createFirmContextValue('user-1', {
      firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER',
    })}`,
  })
  new Headers(options.headers).forEach((value, name) => headers.set(name, value))
  return new Request('http://localhost:3000/api/forgeboard/workflows/workflow-1?size=10', {
    method,
    ...options,
    headers,
  })
}

describe('ForgeBoard BFF proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_SECRET', 'a test-only secret with sufficient length')
    vi.stubEnv('AUTH_URL', 'http://localhost:3000')
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubEnv('FORGEBOARD_TOKEN_ISSUER', 'forgeboard')
    vi.stubEnv('FORGEBOARD_PUBLIC_ORIGIN', 'http://localhost:3000')
    vi.stubEnv('FORGEBOARD_PREVIEW_FIRM_SLUGS', '')
    mocks.auth.mockResolvedValue(session)
    mocks.apiSessionFromRequest.mockResolvedValue(apiSession)
    mocks.upstreamResponse.mockResolvedValue(new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Total-Count': '0',
        'X-Correlation-Id': 'request-1',
        'Set-Cookie': 'JSESSIONID=private',
        Authorization: 'Bearer must-not-reach-browser',
      },
    }))
  })

  it('returns 401 without an Auth.js session', async () => {
    mocks.auth.mockResolvedValue(null)
    const response = await GET(await request(), routeContext)

    expect(response.status).toBe(401)
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('returns 404 for a signed firm outside the session before contacting Spring', async () => {
    const response = await GET(await request('GET', {
      headers: {
        Cookie: `forgeboard-firm-context=${await createFirmContextValue('user-1', {
          firmId: 'other-firm-id', firmSlug: 'other-firm', role: 'OWNER',
        })}`,
      },
    }), routeContext)

    expect(response.status).toBe(404)
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('returns 401 before inspecting a missing firm cookie', async () => {
    mocks.auth.mockResolvedValue(null)
    const response = await GET(new Request('http://localhost:3000/api/forgeboard/workflows/workflow-1'), routeContext)

    expect(response.status).toBe(401)
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('rejects a stale signed context for a firm removed from the preview allow-list', async () => {
    vi.stubEnv('FORGEBOARD_PREVIEW_FIRM_SLUGS', 'other-firm')
    const response = await GET(await request(), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.apiSessionFromRequest).toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('returns 404, not preview denial, for another user\'s signed non-preview firm context', async () => {
    vi.stubEnv('FORGEBOARD_PREVIEW_FIRM_SLUGS', 'hearth')
    const response = await GET(await request('GET', {
      headers: {
        Cookie: `forgeboard-firm-context=${await createFirmContextValue('other-user', {
          firmId: 'other-firm-id', firmSlug: 'other-firm', role: 'OWNER',
        })}`,
      },
    }), routeContext)

    expect(response.status).toBe(404)
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('forwards an authenticated GET with server-side tenant identity only', async () => {
    const response = await GET(await request(), routeContext)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
    expect(mocks.upstreamResponse).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/workflows/workflow-1?size=10',
      method: 'GET',
      firmId: 'firm-1',
    }))
    const forwarded = mocks.upstreamResponse.mock.calls[0][0].headers as Headers
    expect(forwarded.get('x-forgeboard-firm')).toBeNull()
    expect(forwarded.get('cookie')).toBeNull()
  })

  it('does not allow a browser-supplied firm header to override its signed context', async () => {
    const response = await GET(await request('GET', {
      headers: { 'X-ForgeBoard-Firm-Slug': 'other-firm' },
    }), routeContext)

    expect(response.status).toBe(200)
    expect(mocks.upstreamResponse).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-1' }))
  })

  it('forwards same-origin mutations with their exact JSON body', async () => {
    const response = await POST(await request('POST', {
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'July bookkeeping' }),
    }), routeContext)

    expect(response.status).toBe(200)
    const forwarded = mocks.upstreamResponse.mock.calls[0][0]
    expect(new TextDecoder().decode(forwarded.body)).toBe('{"title":"July bookkeeping"}')
  })

  it('rejects cross-origin mutations before session or backend access', async () => {
    const response = await POST(await request('POST', {
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: '{}',
    }), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('rejects unsafe requests without an Origin before session or backend access', async () => {
    const response = await POST(await request('POST', { body: '{}' }), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('rejects sessions whose access-token refresh failed before proxying', async () => {
    mocks.auth.mockResolvedValue({ ...session, error: 'RefreshAccessTokenError' })
    const response = await GET(await request(), routeContext)

    expect(response.status).toBe(401)
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('rejects a session missing its private API credentials before proxying', async () => {
    mocks.apiSessionFromRequest.mockResolvedValue(undefined)
    const response = await GET(await request(), routeContext)

    expect(response.status).toBe(401)
    expect(mocks.upstreamResponse).not.toHaveBeenCalled()
  })

  it('binds a session-authorized firm selection into an HttpOnly signed context cookie', async () => {
    const response = await selectFirmContext(new Request('http://localhost:3000/api/forgeboard/firm-context', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ firmSlug: 'hearth' }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('forgeboard-firm-context=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).not.toContain('private-access-token')
  })

  it('passes Spring conflicts through without credential headers', async () => {
    mocks.upstreamResponse.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'stale version' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'JSESSIONID=private', Authorization: 'Bearer hidden' },
    }))
    const response = await POST(await request('POST', {
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: '{}',
    }), routeContext)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'stale version' })
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('authorization')).toBeNull()
  })
})
