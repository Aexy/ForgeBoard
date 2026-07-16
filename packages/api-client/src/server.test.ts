import { describe, expect, it, vi } from 'vitest'

describe('server API transport', () => {
  it('adds bearer and firm headers without leaking credentials into response handling', async () => {
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))))
    const { serverApi } = await import('./server')
    await serverApi({ accessToken: 'private-token', accessTokenExpiresAt: 1, refreshToken: 'private-refresh', user: { id: 'user-1', email: 'user@example.com' }, firms: [] })
      .request({ path: '/api/workflows', firmId: 'firm-1' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('http://spring:8080/api/workflows')
    const headers = vi.mocked(fetch).mock.calls[0][1]!.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer private-token')
    expect(headers.get('X-ForgeBoard-Firm')).toBe('firm-1')
  })

  it.each([
    'https://attacker.example/api/workflows',
    '//attacker.example/api/workflows',
    '/identity',
    '/api.evil/workflows',
  ])('rejects untrusted API destination %s before adding a bearer token', async (path) => {
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubGlobal('fetch', vi.fn())
    const { serverApi } = await import('./server')

    await expect(serverApi({ accessToken: 'private-token', accessTokenExpiresAt: 1, refreshToken: 'private-refresh', user: { id: 'user-1', email: 'user@example.com' }, firms: [] })
      .request({ path }))
      .rejects.toThrow(/configured backend origin|relative \/api path/)

    expect(fetch).not.toHaveBeenCalled()
  })
})
