import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getToken: vi.fn() }))

vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }))

import { apiSessionFromRequest } from '@/lib/auth-session'

const environment = {
  AUTH_SECRET: 'a test-only secret with sufficient length',
  AUTH_URL: 'http://localhost:3000',
  FORGEBOARD_API_BASE_URL: 'http://spring:8080',
  FORGEBOARD_TOKEN_ISSUER: 'forgeboard',
  FORGEBOARD_PUBLIC_ORIGIN: 'http://localhost:3000',
}

const privateToken = {
  accessToken: 'spring-access-token',
  accessTokenExpiresAt: Date.now() + 60_000,
  refreshToken: 'spring-refresh-token',
  user: { id: 'user-1', email: 'owner@example.com' },
  firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth', role: 'OWNER' as const }],
}

describe('server-only Auth.js API session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value)
  })

  it('reads Spring credentials from the encrypted Auth.js JWT instead of the browser session', async () => {
    mocks.getToken.mockResolvedValue(privateToken)
    const browserSession = { user: privateToken.user, firms: privateToken.firms }

    await expect(apiSessionFromRequest(new Request('http://localhost:3000/api/forgeboard/clients'), browserSession))
      .resolves.toMatchObject({ accessToken: 'spring-access-token', refreshToken: 'spring-refresh-token' })
    expect(mocks.getToken).toHaveBeenCalledWith(expect.objectContaining({
      secret: environment.AUTH_SECRET,
      secureCookie: false,
    }))
  })

  it('rejects a decoded grant that does not belong to the browser session user', async () => {
    mocks.getToken.mockResolvedValue(privateToken)

    await expect(apiSessionFromRequest(new Request('http://localhost:3000/api/forgeboard/clients'), {
      user: { id: 'other-user', email: 'other@example.com' },
      firms: privateToken.firms,
    })).resolves.toBeUndefined()
  })
})
