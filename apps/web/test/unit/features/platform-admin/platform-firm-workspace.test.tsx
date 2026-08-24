// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  employees: vi.fn(), invite: vi.fn(), inviteReset: vi.fn(), reissue: vi.fn(), reissueReset: vi.fn(), revoke: vi.fn(), role: vi.fn(), suspend: vi.fn(), reactivate: vi.fn(), remove: vi.fn(), reset: vi.fn(), resetResultReset: vi.fn(),
}))
vi.mock('@/features/platform-admin/platform-admin-transport', () => ({
  useGetPlatformEmployeesQuery: mocks.employees,
  useGeneratePlatformInvitationMutation: () => [mocks.invite, { isLoading: false, reset: mocks.inviteReset }],
  useReissuePlatformInvitationMutation: () => [mocks.reissue, { reset: mocks.reissueReset }], useRevokePlatformInvitationMutation: () => [mocks.revoke],
  useUpdatePlatformEmployeeRoleMutation: () => [mocks.role], useSuspendPlatformMembershipMutation: () => [mocks.suspend],
  useReactivatePlatformMembershipMutation: () => [mocks.reactivate], useRemovePlatformMembershipMutation: () => [mocks.remove],
  useGeneratePasswordResetMutation: () => [mocks.reset, { reset: mocks.resetResultReset }],
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { PlatformFirmWorkspace } from '@/features/platform-admin/PlatformFirmWorkspace'

const firm = { id: 'firm-1', name: 'Northstar Accounting', slug: 'northstar', status: 'ACTIVE' as const, createdAt: '2026-07-23T10:00:00Z', employeeCount: 1 }
const otherFirm = { ...firm, id: 'firm-2', slug: 'hearth' }
const employee = { membershipId: 'membership-1', userId: 'user-1', displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' as const, status: 'ACTIVE' as const }
const invitation = { actionId: 'action-1', link: 'https://forgeboard.example/invite/one-time', expiresAt: '2026-08-25T12:00:00Z' }
const reset = { actionId: 'action-2', link: 'https://forgeboard.example/reset/one-time', expiresAt: '2026-08-25T12:00:00Z' }
function renderWorkspace(currentFirm = firm) { return render(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={currentFirm} onBack={vi.fn()} /></LanguageProvider>) }

describe('Platform firm workspace', () => {
  afterEach(cleanup)
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('shows employee loading, error, and empty states', () => {
    mocks.employees.mockReturnValue({ isLoading: true }); const view = renderWorkspace(); expect(screen.getByText('Loading employees…')).toBeVisible()
    mocks.employees.mockReturnValue({ isLoading: false, isError: true }); view.rerender(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={firm} onBack={vi.fn()} /></LanguageProvider>); expect(screen.getByRole('alert')).toHaveTextContent('Employees could not be loaded')
    mocks.employees.mockReturnValue({ isLoading: false, data: [] }); view.rerender(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={firm} onBack={vi.fn()} /></LanguageProvider>); expect(screen.getByText('No employees yet')).toBeVisible()
  })

  it('generates invitation links without temporary passwords and clears the one-time link on dismissal or firm switch', async () => {
    mocks.employees.mockReturnValue({ isLoading: false, data: [employee] })
    mocks.invite.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(invitation) })
    const view = renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: 'Invite employee' }))
    expect(screen.queryByLabelText('Initial password')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Employee name'), { target: { value: 'Avery Accountant' } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'avery@example.com' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send invitation' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.invite).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-1', request: expect.objectContaining({ email: 'avery@example.com' }) })))
    expect(await screen.findByLabelText('Invitation link')).toHaveValue(invitation.link)
    expect(mocks.inviteReset).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss invitation link' }))
    expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()
    expect(mocks.inviteReset).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Invite employee' }))
    fireEvent.change(screen.getByLabelText('Employee name'), { target: { value: 'Avery Accountant' } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'avery@example.com' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send invitation' }).closest('form')!)
    expect(await screen.findByLabelText('Invitation link')).toBeVisible()
    view.rerender(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={otherFirm} onBack={vi.fn()} /></LanguageProvider>)
    await vi.waitFor(() => expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument())
    expect(mocks.inviteReset).toHaveBeenCalledTimes(4)
    view.unmount()
    expect(mocks.inviteReset).toHaveBeenCalledTimes(5)
  })

  it('lets a platform administrator manage only the selected firm membership and generate a reset link for an existing account', async () => {
    mocks.employees.mockReturnValue({ isLoading: false, data: [employee, { membershipId: 'membership-2', userId: null, displayName: null, email: 'pending@example.com', role: 'MEMBER', status: 'INVITED' }] })
    mocks.role.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ ...employee, role: 'MANAGER' }) })
    mocks.suspend.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ ...employee, status: 'SUSPENDED' }) })
    mocks.reset.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(reset) })
    renderWorkspace()
    fireEvent.change(screen.getByLabelText('Role Mira Miller'), { target: { value: 'MANAGER' } })
    await vi.waitFor(() => expect(mocks.role).toHaveBeenCalledWith({ firmId: 'firm-1', membershipId: 'membership-1', role: 'MANAGER' }))
    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }))
    await vi.waitFor(() => expect(mocks.suspend).toHaveBeenCalledWith({ firmId: 'firm-1', membershipId: 'membership-1' }))
    expect(screen.getByRole('button', { name: 'Reissue invitation' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Generate password reset' }))
    await vi.waitFor(() => expect(mocks.reset).toHaveBeenCalledWith({ firmId: 'firm-1', userId: 'user-1' }))
    expect(await screen.findByLabelText('Password reset link')).toHaveValue(reset.link)
    expect(mocks.resetResultReset).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss password reset link' }))
    expect(mocks.resetResultReset).toHaveBeenCalledTimes(2)
  })
})
