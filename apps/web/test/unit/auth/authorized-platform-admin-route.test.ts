import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), apiSessionFromRequest: vi.fn(), response: vi.fn() }))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth-session', () => ({ apiSessionFromRequest: mocks.apiSessionFromRequest }))
vi.mock('@forgeboard/api-client/server', () => ({ serverApi: () => ({ response: mocks.response }) }))

import { authorizedPlatformAdminRoute } from '@/lib/authorized-platform-admin-route'

const session = {
  user: { id: 'platform-admin-1', email: 'owner@example.com' },
  firms: [],
  platformAdministrator: true,
}
const privateSession = { ...session, accessToken: 'private-access-token', refreshToken: 'private-refresh-token', accessTokenExpiresAt: Date.now() + 60_000 }

describe('authorizedPlatformAdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue(session)
    mocks.apiSessionFromRequest.mockResolvedValue(privateSession)
  })

  it('keeps anonymous and refresh-failed sessions separate from entitlement denial', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    await expect(authorizedPlatformAdminRoute(new Request('http://localhost'))).resolves.toEqual({ kind: 'authentication-required' })

    mocks.auth.mockResolvedValueOnce({ ...session, error: 'RefreshAccessTokenError' })
    await expect(authorizedPlatformAdminRoute(new Request('http://localhost'))).resolves.toEqual({ kind: 'authentication-required' })

    mocks.auth.mockResolvedValueOnce({ ...session, platformAdministrator: false })
    await expect(authorizedPlatformAdminRoute(new Request('http://localhost'))).resolves.toEqual({ kind: 'platform-admin-forbidden' })
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
  })

  it('returns a server transport for an entitled administrator with no firms', async () => {
    const result = await authorizedPlatformAdminRoute(new Request('http://localhost'))

    expect(result).toMatchObject({
      kind: 'authorized',
      route: { user: { id: 'platform-admin-1', email: 'owner@example.com' }, api: { response: mocks.response } },
    })
    expect(JSON.stringify(result)).not.toContain('private-access-token')
    expect(JSON.stringify(result)).not.toContain('private-refresh-token')
  })
})
