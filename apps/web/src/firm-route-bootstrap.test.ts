import { NextRequest, type NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  session: undefined as unknown,
  auth: vi.fn((handler) => async (request: NextRequest) => {
    Object.defineProperty(request, 'auth', { configurable: true, value: mocks.session })
    return handler(request)
  }),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))

import middleware from '@/middleware'
import { firmContextFromCookie, FIRM_CONTEXT_COOKIE } from '@/lib/firm-context-cookie'

const session = {
  user: { id: 'user-1', email: 'owner@example.com' },
  firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth Accounting', role: 'OWNER' as const }],
}
const runMiddleware = middleware as unknown as (request: NextRequest) => Promise<NextResponse>

describe('direct firm-route bootstrap', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'a test-only secret with sufficient length')
    vi.stubEnv('AUTH_URL', 'http://localhost:3000')
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubEnv('FORGEBOARD_TOKEN_ISSUER', 'forgeboard')
    vi.stubEnv('FORGEBOARD_PUBLIC_ORIGIN', 'http://localhost:3000')
    mocks.session = session
  })

  it('establishes a validated HttpOnly context before a direct workflow URL renders', async () => {
    // A direct bookmark enters through middleware before any client RTK Query
    // component can hydrate and make a BFF request.
    const response = await runMiddleware(new NextRequest('http://localhost:3000/firms/hearth/workflow/workflow-1'))
    const contextCookie = response.cookies.get(FIRM_CONTEXT_COOKIE)

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(contextCookie).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/api/forgeboard' })
    await expect(firmContextFromCookie(`${FIRM_CONTEXT_COOKIE}=${contextCookie?.value}`, 'user-1')).resolves.toMatchObject({
      firmId: 'firm-1',
      firmSlug: 'hearth',
    })
  })
})
