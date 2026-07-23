import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/forgeboard/onboarding/firms/route'

describe('public onboarding BFF', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'a test-only secret with sufficient length')
    vi.stubEnv('AUTH_URL', 'http://localhost:3000')
    vi.stubEnv('FORGEBOARD_API_BASE_URL', 'http://spring:8080')
    vi.stubEnv('FORGEBOARD_TOKEN_ISSUER', 'forgeboard')
    vi.stubEnv('FORGEBOARD_PUBLIC_ORIGIN', 'http://localhost:3000')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubGlobal('fetch', vi.fn())
  })

  it('forwards only valid public onboarding data without Spring response headers', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ firmId: '11111111-1111-1111-1111-111111111111', firmSlug: 'hearth' }), { status: 201, headers: { 'Set-Cookie': 'JSESSIONID=private' } }))
    const response = await POST(new Request('http://localhost:3000/api/forgeboard/onboarding/firms', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: JSON.stringify({ firmName: 'Hearth Accounting', firmSlug: 'hearth', ownerName: 'Owner Name', ownerEmail: 'owner@example.com', password: 'correct-password' }) }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ firmId: '11111111-1111-1111-1111-111111111111', firmSlug: 'hearth' })
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe('http://spring:8080/api/onboarding/firms')
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('rejects malformed details before calling Spring', async () => {
    const response = await POST(new Request('http://localhost:3000/api/forgeboard/onboarding/firms', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: JSON.stringify({ firmSlug: 'Not safe' }) }))
    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('accepts a loopback development alias for the incoming onboarding origin', async () => {
    vi.stubEnv('FORGEBOARD_PUBLIC_ORIGIN', 'http://127.0.0.1:3000')
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ firmId: '11111111-1111-1111-1111-111111111111', firmSlug: 'hearth' }), { status: 201 }))

    const response = await POST(new Request('http://localhost:3000/api/forgeboard/onboarding/firms', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: JSON.stringify({ firmName: 'Hearth Accounting', firmSlug: 'hearth', ownerName: 'Owner Name', ownerEmail: 'owner@example.com', password: 'correct-password' }) }))

    expect(response.status).toBe(201)
  })

  it('rejects cross-origin requests and strips unexpected upstream fields', async () => {
    const crossOrigin = await POST(new Request('http://localhost:3000/api/forgeboard/onboarding/firms', { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: '{}' }))
    expect(crossOrigin.status).toBe(403)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ firmId: '11111111-1111-1111-1111-111111111111', firmSlug: 'hearth', ownerEmail: 'private@example.com', accessToken: 'private' }), { status: 201 }))
    const response = await POST(new Request('http://localhost:3000/api/forgeboard/onboarding/firms', { method: 'POST', headers: { Origin: 'http://localhost:3000' }, body: JSON.stringify({ firmName: 'Hearth Accounting', firmSlug: 'hearth', ownerName: 'Owner Name', ownerEmail: 'owner@example.com', password: 'correct-password' }) }))
    expect(await response.json()).toEqual({ firmId: '11111111-1111-1111-1111-111111111111', firmSlug: 'hearth' })
  })
})
