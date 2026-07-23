// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ employees: vi.fn(), create: vi.fn(), role: vi.fn(), suspend: vi.fn(), reactivate: vi.fn() }))
vi.mock('@/features/platform-admin/platform-admin-transport', () => ({
  useGetPlatformEmployeesQuery: mocks.employees, useCreatePlatformEmployeeMutation: () => [mocks.create, { isLoading: false }], useUpdatePlatformEmployeeRoleMutation: () => [mocks.role], useSuspendPlatformMembershipMutation: () => [mocks.suspend], useReactivatePlatformMembershipMutation: () => [mocks.reactivate],
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { LanguageProvider } from '@/app/LanguageProvider'
import { PlatformFirmWorkspace } from '@/features/platform-admin/PlatformFirmWorkspace'

const firm = { id: 'firm-1', name: 'Northstar Accounting', slug: 'northstar', status: 'ACTIVE' as const, createdAt: '2026-07-23T10:00:00Z', employeeCount: 1 }
const employee = { membershipId: 'membership-1', userId: 'user-1', displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' as const, status: 'ACTIVE' as const }
function renderWorkspace() { return render(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={firm} onBack={vi.fn()} /></LanguageProvider>) }

describe('Platform firm workspace', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.employees.mockReset(); mocks.create.mockReset(); mocks.role.mockReset(); mocks.suspend.mockReset(); vi.stubGlobal('confirm', vi.fn(() => true)) })
  it('shows employee loading, error, and empty states', () => { mocks.employees.mockReturnValue({ isLoading: true }); const view = renderWorkspace(); expect(screen.getByText('Loading employees…')).toBeVisible(); mocks.employees.mockReturnValue({ isLoading: false, isError: true }); view.rerender(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={firm} onBack={vi.fn()} /></LanguageProvider>); expect(screen.getByRole('alert')).toHaveTextContent('Employees could not be loaded'); mocks.employees.mockReturnValue({ isLoading: false, data: [] }); view.rerender(<LanguageProvider initialLanguage="en"><PlatformFirmWorkspace firm={firm} onBack={vi.fn()} /></LanguageProvider>); expect(screen.getByText('No employees yet')).toBeVisible() })
  it('provisions and manages only the selected firm employee', async () => { mocks.employees.mockReturnValue({ isLoading: false, data: [employee] }); mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(employee) }); mocks.role.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ ...employee, role: 'MANAGER' }) }); mocks.suspend.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ ...employee, status: 'SUSPENDED' }) }); renderWorkspace(); fireEvent.click(screen.getByRole('button', { name: 'Provision employee' })); fireEvent.change(screen.getByLabelText('Employee name'), { target: { value: 'Avery Accountant' } }); fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'avery@example.com' } }); fireEvent.change(screen.getByLabelText('Initial password'), { target: { value: 'temporary-password' } }); fireEvent.submit(screen.getByRole('button', { name: 'Provision employee' }).closest('form')!); await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-1' }))); fireEvent.change(screen.getByLabelText('Role Mira Miller'), { target: { value: 'MANAGER' } }); await vi.waitFor(() => expect(mocks.role).toHaveBeenCalledWith({ firmId: 'firm-1', membershipId: 'membership-1', role: 'MANAGER' })); fireEvent.click(screen.getByRole('button', { name: 'Suspend access' })); await vi.waitFor(() => expect(mocks.suspend).toHaveBeenCalledWith({ firmId: 'firm-1', membershipId: 'membership-1' })) })
})
