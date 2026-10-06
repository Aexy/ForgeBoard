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
      sessionExpiresAt: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
      identity: { email: 'owner@example.com' }, firms: [{ id: 'firm-1', slug: 'hearth', name: 'Hearth', role: 'OWNER' }], platformAdministrator: true,
    })))
    const { authConfig } = await import('@/auth')
    const provider = authConfig.providers[0] as unknown as { options: { authorize: (input: Record<string, string>) => Promise<Record<string, unknown> | null> } }
    const user = await provider.options.authorize({ email: 'owner@example.com', password: 'correct-horse' })

    expect(fetch).toHaveBeenCalledWith('http://spring:8080/api/auth/grant', expect.objectContaining({ method: 'POST' }))
    expect(user).toMatchObject({ accessToken: 'spring-access-token', refreshToken: 'spring-refresh-token' })

    const session = await authConfig.callbacks.session!({
      session: { user: { name: null, email: null, image: null }, expires: 'never' },
      token: { sub: 'owner@example.com', email: 'owner@example.com', accessToken: 'spring-access-token', accessTokenExpiresAt: 1, sessionExpiresAt: Date.now() + 60_000, refreshToken: 'spring-refresh-token', firms: [] },
      user: undefined,
      newSession: undefined,
      trigger: undefined,
    } as never)
    expect(session).toEqual(expect.objectContaining({ user: { id: 'owner@example.com', email: 'owner@example.com' }, firms: [], platformAdministrator: false }))
    expect(JSON.stringify(session)).not.toContain('spring-access-token')
    expect(JSON.stringify(session)).not.toContain('spring-refresh-token')
    expect(session).not.toHaveProperty('sessionExpiresAt')
    expect(session).not.toHaveProperty('accessTokenExpiresAt')
  })

  it('rotates credentials shortly before expiry and signals a failed refresh without exposing tokens', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }))
    const { refreshPrivateToken } = await import('@/auth')
    const refreshed = await refreshPrivateToken({ accessToken: 'old', accessTokenExpiresAt: 1, sessionExpiresAt: Date.now() + 60_000, refreshToken: 'refresh', user: { id: 'user-1', email: 'owner@example.com' }, firms: [], platformAdministrator: false })
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
        sessionExpiresAt: Date.now() + 60_000,
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

  it.each([undefined, 'false', 'true'])('sends Remember me=%s as a boolean on the initial grant', async (remember) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      accessToken: 'access', accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(), refreshToken: 'refresh',
      sessionExpiresAt: new Date(Date.now() + (remember === 'true' ? 30 * 24 : 12) * 60 * 60_000).toISOString(),
      identity: { email: 'owner@example.com' }, firms: [], platformAdministrator: false,
    })))
    const { authConfig } = await import('@/auth')
    const provider = authConfig.providers[0] as unknown as { options: { authorize: (input: Record<string, string | undefined>) => Promise<Record<string, unknown> | null> } }
    const user = await provider.options.authorize({ email: 'owner@example.com', password: 'correct-horse', remember })
    expect(user).not.toBeNull()
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ email: 'owner@example.com', password: 'correct-horse', remember: remember === 'true' })
    expect(authConfig.session.maxAge).toBe(30 * 24 * 60 * 60)
  })

  it('rejects malformed Remember me values before contacting Spring', async () => {
    const { authConfig } = await import('@/auth')
    const provider = authConfig.providers[0] as unknown as { options: { authorize: (input: Record<string, string>) => Promise<Record<string, unknown> | null> } }
    expect(await provider.options.authorize({ email: 'owner@example.com', password: 'correct-horse', remember: 'yes' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves the earlier absolute deadline during refresh and never sends remember again', async () => {
    const deadline = Date.now() + 12 * 60 * 60_000
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      accessToken: 'rotated-access', accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(), refreshToken: 'rotated-refresh',
      sessionExpiresAt: new Date(deadline + 60_000).toISOString(), identity: { email: 'owner@example.com' }, firms: [], platformAdministrator: false,
    })))
    const { refreshPrivateToken } = await import('@/auth')
    const result = await refreshPrivateToken({ accessToken: 'old', accessTokenExpiresAt: 1, sessionExpiresAt: deadline, refreshToken: 'refresh', user: { id: 'user-1', email: 'owner@example.com' }, firms: [], platformAdministrator: false })
    expect(result).toMatchObject({ accessToken: 'rotated-access', refreshToken: 'rotated-refresh', sessionExpiresAt: deadline })
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ refreshToken: 'refresh' })
  })

  it.each(['/firms/hearth/my-work', '/platform-admin'])('denies expired sessions at %s without refreshing a still-valid access token', async (path) => {
    const { authConfig, refreshPrivateToken } = await import('@/auth')
    const privateToken = { user: { id: 'user-1', email: 'owner@example.com' }, accessToken: 'valid-access', accessTokenExpiresAt: Date.now() + 60 * 60_000, refreshToken: 'refresh', sessionExpiresAt: Date.now() - 1, firms: [], platformAdministrator: true }
    expect(await refreshPrivateToken(privateToken)).toHaveProperty('error', 'RefreshAccessTokenError')
    const token = await authConfig.callbacks.jwt!({ token: privateToken } as never)
    const session = await authConfig.callbacks.session!({ session: { user: {}, expires: 'never' }, token } as never)
    expect(session).toHaveProperty('error', 'RefreshAccessTokenError')
    expect(session).not.toHaveProperty('sessionExpiresAt')
    expect(await authConfig.callbacks.authorized!({ request: new Request(`http://localhost:3000${path}`), auth: session } as never)).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a grant with a missing or malformed session deadline', async () => {
    const { toPrivateToken } = await import('@/lib/auth-session')
    const grant = { accessToken: 'access', accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(), refreshToken: 'refresh', identity: { email: 'owner@example.com' }, firms: [], platformAdministrator: false }
    expect(() => toPrivateToken({ ...grant, sessionExpiresAt: 'invalid' }, 'user-1')).toThrow('Invalid session expiry')
    expect(() => toPrivateToken({ ...grant, sessionExpiresAt: undefined } as never, 'user-1')).toThrow('Invalid session expiry')
  })
})
