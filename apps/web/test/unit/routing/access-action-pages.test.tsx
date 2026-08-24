import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invitation: vi.fn(), reset: vi.fn() }))
vi.mock('@/features/access/InvitationAcceptanceForm', () => ({ InvitationAcceptanceForm: mocks.invitation }))
vi.mock('@/features/access/PasswordResetForm', () => ({ PasswordResetForm: mocks.reset }))

import InvitationPage from '@/app/(access)/invite/[token]/page'
import ResetPage from '@/app/(access)/reset/[token]/page'

describe('access action routes', () => {
  it('keeps an invitation route token at the server route/component boundary', async () => {
    const page = await InvitationPage({ params: Promise.resolve({ token: 'invite-route-token' }) })
    expect(page.props.token).toBe('invite-route-token')
  })

  it('keeps a reset route token at the server route/component boundary', async () => {
    const page = await ResetPage({ params: Promise.resolve({ token: 'reset-route-token' }) })
    expect(page.props.token).toBe('reset-route-token')
  })
})
