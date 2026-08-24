// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useFirmContext: vi.fn(), useGetEmployeesQuery: vi.fn(), invite: vi.fn(), reissue: vi.fn(), revoke: vi.fn(), role: vi.fn(), suspend: vi.fn(), reactivate: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/features/employees/employees-transport', () => ({
  useGetEmployeesQuery: mocks.useGetEmployeesQuery,
  useGenerateInvitationMutation: () => [mocks.invite, { isLoading: false }],
  useReissueInvitationMutation: () => [mocks.reissue], useRevokeInvitationMutation: () => [mocks.revoke],
  useUpdateMembershipRoleMutation: () => [mocks.role], useSuspendMembershipMutation: () => [mocks.suspend],
  useReactivateMembershipMutation: () => [mocks.reactivate], useRemoveMembershipMutation: () => [mocks.remove],
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { Employees } from '@/features/employees/Employees'
import { LanguageProvider } from '@/app/LanguageProvider'

function renderWithLanguage(language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><Employees /></LanguageProvider>)
}

const employee = { membershipId: 'membership-1', userId: 'user-1', displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' as const, status: 'ACTIVE' as const }
const invitation = { actionId: 'action-1', link: 'https://forgeboard.example/invite/one-time', expiresAt: '2026-08-25T12:00:00Z' }

describe('Employees route feature', () => {
  afterEach(cleanup)
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => typeof mock === 'function' && mock.mockReset())
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('shows loading, error, and empty states for an authorized firm', () => {
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: true })
    const view = renderWithLanguage()
    expect(screen.getByText('Loading employees…')).toBeVisible()
    expect(mocks.useGetEmployeesQuery).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }) }), { skip: false })
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, isError: true }); view.rerender(<LanguageProvider initialLanguage="en"><Employees /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, data: [] }); view.rerender(<LanguageProvider initialLanguage="en"><Employees /></LanguageProvider>)
    expect(screen.getByText('No employees yet')).toBeVisible()
  })

  it('generates a one-time invitation without a temporary-password field and clears it on dismissal or firm switch', async () => {
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, data: [employee] })
    mocks.invite.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(invitation) })
    const view = renderWithLanguage()
    fireEvent.click(screen.getByText('New employee'))
    expect(screen.queryByLabelText('Temporary password')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Employee name'), { target: { value: employee.displayName } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: employee.email } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send invitation' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.invite).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), request: expect.objectContaining({ email: employee.email, role: 'MEMBER' }) })))
    expect(await screen.findByLabelText('Invitation link')).toHaveValue(invitation.link)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss invitation link' }))
    expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Employee name'), { target: { value: employee.displayName } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: employee.email } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send invitation' }).closest('form')!)
    expect(await screen.findByLabelText('Invitation link')).toBeVisible()
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-2', firmSlug: 'northstar', role: 'OWNER' })
    view.rerender(<LanguageProvider initialLanguage="en"><Employees /></LanguageProvider>)
    await vi.waitFor(() => expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument())
  })

  it('limits role and membership actions to the authority Spring grants the current role', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'ADMINISTRATOR' })
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, data: [{ ...employee, role: 'OWNER' }, employee, { membershipId: 'membership-2', userId: null, displayName: null, email: 'pending@example.com', role: 'MEMBER', status: 'INVITED' }] })
    renderWithLanguage()
    expect(screen.getByLabelText('Role Mira Miller')).toBeVisible()
    expect(screen.getByLabelText('Role pending@example.com')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reissue invitation' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Revoke invitation' })).toBeVisible()
    expect(screen.queryByLabelText('Role null')).not.toBeInTheDocument()
  })

  it('does not issue an employee query for memberships Spring does not authorize', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' })
    mocks.useGetEmployeesQuery.mockReturnValue({})
    renderWithLanguage()
    expect(screen.getByRole('alert')).toHaveTextContent('Only owners and administrators')
    expect(mocks.useGetEmployeesQuery).toHaveBeenCalledWith(expect.anything(), { skip: true })
    expect(screen.queryByRole('button', { name: '+ New employee' })).not.toBeInTheDocument()
  })

  it('renders German employee controls without translating role values', () => {
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, data: [employee] })
    renderWithLanguage('de')
    expect(screen.getByRole('heading', { name: 'Mitarbeitende' })).toBeVisible()
    fireEvent.click(screen.getByText('Neue Mitarbeitende'))
    expect(screen.getByLabelText('Geschäftliche E-Mail-Adresse')).toHaveAttribute('name', 'email')
    expect(screen.getByLabelText('Rolle Mira Miller').querySelector('option[value="MEMBER"]')).toHaveTextContent('mitglied')
  })
})
