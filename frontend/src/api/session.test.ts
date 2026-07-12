import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFirm, login, logout } from './session'

describe('session API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates a credentialed browser session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(login('owner@example.com', 'secret-password')).resolves.toEqual({ email: 'owner@example.com' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/session', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf' }),
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

  it('creates a firm through the public onboarding endpoint', async () => {
    const result = { firmId: 'firm-1', firmSlug: 'ledger-co', ownerId: 'owner-1', ownerEmail: 'owner@test.dev' }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await createFirm({ firmName: 'Ledger & Co', firmSlug: 'ledger-co', ownerName: 'Ada', ownerEmail: 'owner@test.dev', password: 'long-secret-password' })
    expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/firms', expect.objectContaining({
      method: 'POST', credentials: 'include',
    }))
  })
})
