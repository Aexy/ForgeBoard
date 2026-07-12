import { afterEach, describe, expect, it, vi } from 'vitest'
import { login, logout } from './session'

describe('session API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a credentialed browser session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ email: 'owner@example.com' }), { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(login('owner@example.com', 'secret-password')).resolves.toEqual({ email: 'owner@example.com' })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({
      method: 'POST', credentials: 'include',
    }))
  })

  it('uses the server CSRF token when ending a session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await logout()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/session', expect.objectContaining({
      method: 'DELETE', headers: { 'X-XSRF-TOKEN': 'csrf' }, credentials: 'include',
    }))
  })
})
