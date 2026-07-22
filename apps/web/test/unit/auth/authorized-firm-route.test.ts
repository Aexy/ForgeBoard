import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), apiSessionFromRequest: vi.fn(), response: vi.fn() }))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth-session', () => ({ apiSessionFromRequest: mocks.apiSessionFromRequest }))
vi.mock('@forgeboard/api-client/server', () => ({ serverApi: () => ({ response: mocks.response }) }))

import { authorizedFirmRoute } from '@/lib/authorized-firm-route'

const session = { user: { id: 'user-1', email: 'owner@example.com' }, firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth', role: 'OWNER' as const }] }
const privateSession = { ...session, accessToken: 'private-access-token', refreshToken: 'private-refresh-token', accessTokenExpiresAt: Date.now() + 60_000 }

describe('authorizedFirmRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue(session)
    mocks.apiSessionFromRequest.mockResolvedValue(privateSession)
  })

  it('keeps anonymous and failed-refresh requests separate from inaccessible firms', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    await expect(authorizedFirmRoute(new Request('http://localhost'), 'hearth')).resolves.toEqual({ kind: 'authentication-required' })
    await expect(authorizedFirmRoute(new Request('http://localhost'), 'other')).resolves.toEqual({ kind: 'firm-not-found' })
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
  })

  it('returns only immutable firm context and server transport after membership validation', async () => {
    const result = await authorizedFirmRoute(new Request('http://localhost'), 'hearth', 'user-1')

    expect(result).toMatchObject({ kind: 'authorized', route: { firm: { firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }, api: { response: mocks.response } } })
    expect(JSON.stringify(result)).not.toContain('private-access-token')
    expect(JSON.stringify(result)).not.toContain('private-refresh-token')
  })

  it('rejects a signed cookie binding for a different authenticated user before Spring access', async () => {
    await expect(authorizedFirmRoute(new Request('http://localhost'), 'hearth', 'other-user')).resolves.toEqual({ kind: 'firm-not-found' })
    expect(mocks.apiSessionFromRequest).not.toHaveBeenCalled()
  })
})
