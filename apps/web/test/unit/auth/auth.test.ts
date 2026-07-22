import { beforeEach, describe, expect, it, vi } from 'vitest'

const environment = {
  AUTH_SECRET: 'a test-only secret with sufficient length',
  AUTH_URL: 'http://localhost:3000',
  FORGEBOARD_API_BASE_URL: 'http://spring:8080',
  FORGEBOARD_TOKEN_ISSUER: 'forgeboard',
  FORGEBOARD_PUBLIC_ORIGIN: 'http://localhost:3000',
}

describe('Auth.js Spring credential broker', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value)
  })

  it('keeps Spring credentials private while exposing only browser-safe session fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      accessToken: 'spring-access-token', accessTokenExpiresAt: '2026-07-16T12:15:00Z', refreshToken: 'spring-refresh-token',
      identity: { email: 'owner@example.com' }, firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth', role: 'OWNER' }],
    })))
    const { authConfig } = await import('@/auth')
    const provider = authConfig.providers[0] as unknown as { options: { authorize: (input: Record<string, string>) => Promise<Record<string, unknown> | null> } }
    const user = await provider.options.authorize({ email: 'owner@example.com', password: 'correct-horse' })

    expect(fetch).toHaveBeenCalledWith('http://spring:8080/api/auth/grant', expect.objectContaining({ method: 'POST' }))
    expect(user).toMatchObject({ accessToken: 'spring-access-token', refreshToken: 'spring-refresh-token' })

    const session = await authConfig.callbacks.session!({
      session: { user: { name: null, email: null, image: null }, expires: 'never' },
      token: { sub: 'owner@example.com', email: 'owner@example.com', accessToken: 'spring-access-token', accessTokenExpiresAt: 1, refreshToken: 'spring-refresh-token', firms: [] },
      user: undefined,
      newSession: undefined,
      trigger: undefined,
    } as never)
    expect(session).toEqual(expect.objectContaining({ user: { id: 'owner@example.com', email: 'owner@example.com' }, firms: [] }))
    expect(JSON.stringify(session)).not.toContain('spring-access-token')
    expect(JSON.stringify(session)).not.toContain('spring-refresh-token')
  })

  it('rotates credentials shortly before expiry and signals a failed refresh without exposing tokens', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }))
    const { refreshPrivateToken } = await import('@/auth')
    const refreshed = await refreshPrivateToken({ accessToken: 'old', accessTokenExpiresAt: 1, refreshToken: 'refresh', user: { id: 'user-1', email: 'owner@example.com' }, firms: [] })
    expect(refreshed.error).toBe('RefreshAccessTokenError')
  })

  it('leaves an anonymous JWT unchanged without calling Spring', async () => {
    const { authConfig } = await import('@/auth')
    const token = { sub: 'anonymous-user', email: 'anonymous@example.com' }

    const result = await authConfig.callbacks.jwt!({ token, user: undefined, account: undefined, profile: undefined, trigger: undefined, session: undefined } as never)

    expect(result).toEqual(token)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('denies a protected firm route after a failed token refresh', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }))
    const { authConfig } = await import('@/auth')
    const refreshedToken = await authConfig.callbacks.jwt!({
      token: {
        sub: 'user-1',
        email: 'owner@example.com',
        accessToken: 'expired-access-token',
        accessTokenExpiresAt: 1,
        refreshToken: 'refresh-token',
        firms: [],
      },
      user: undefined,
      account: undefined,
      profile: undefined,
      trigger: undefined,
      session: undefined,
    } as never)
    const session = await authConfig.callbacks.session!({
      session: { user: { name: null, email: null, image: null }, expires: 'never' },
      token: refreshedToken,
      user: undefined,
      newSession: undefined,
      trigger: undefined,
    } as never)

    expect(session).toEqual(expect.objectContaining({ error: 'RefreshAccessTokenError' }))

    const authorized = await authConfig.callbacks.authorized!({
      request: new Request('http://localhost:3000/firms/hearth/workflow/workflow-1'),
      auth: session,
    } as never)

    expect(authorized).toBe(false)
  })
})
