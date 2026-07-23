// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firms: vi.fn(), create: vi.fn(), suspend: vi.fn(), reactivate: vi.fn() }))
vi.mock('@/features/platform-admin/platform-admin-transport', () => ({
  useGetPlatformFirmsQuery: mocks.firms, useCreatePlatformFirmMutation: () => [mocks.create, { isLoading: false }],
  useSuspendPlatformFirmMutation: () => [mocks.suspend], useReactivatePlatformFirmMutation: () => [mocks.reactivate],
}))
vi.mock('@/features/platform-admin/PlatformFirmWorkspace', () => ({ PlatformFirmWorkspace: () => <div>Firm workspace</div> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { PlatformAdminDashboard } from '@/features/platform-admin/PlatformAdminDashboard'

const firm = { id: 'firm-1', name: 'Northstar Accounting', slug: 'northstar', status: 'ACTIVE' as const, createdAt: '2026-07-23T10:00:00Z', employeeCount: 2 }
function renderDashboard() { return render(<LanguageProvider initialLanguage="en"><PlatformAdminDashboard /></LanguageProvider>) }

describe('Platform administration dashboard', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.firms.mockReset(); mocks.create.mockReset(); mocks.suspend.mockReset(); mocks.reactivate.mockReset(); vi.stubGlobal('confirm', vi.fn(() => true)) })
  it('shows loading, error, and empty states', () => {
    mocks.firms.mockReturnValue({ isLoading: true }); const view = renderDashboard(); expect(screen.getByText('Loading firms…')).toBeVisible()
    mocks.firms.mockReturnValue({ isLoading: false, isError: true }); view.rerender(<LanguageProvider initialLanguage="en"><PlatformAdminDashboard /></LanguageProvider>); expect(screen.getByRole('alert')).toHaveTextContent('Firms could not be loaded')
    mocks.firms.mockReturnValue({ isLoading: false, data: { firms: [], nextCursor: null } }); view.rerender(<LanguageProvider initialLanguage="en"><PlatformAdminDashboard /></LanguageProvider>); expect(screen.getByText('No firms found')).toBeVisible()
  })
  it('submits an accessible search and creates a firm with its initial owner', async () => {
    mocks.firms.mockReturnValue({ isLoading: false, data: { firms: [firm], nextCursor: null } }); mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(firm) }); renderDashboard()
    fireEvent.change(screen.getByLabelText('Search firms'), { target: { value: 'north' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' })); expect(mocks.firms).toHaveBeenLastCalledWith({ query: 'north' })
    fireEvent.click(screen.getByRole('button', { name: '+ New firm' })); fireEvent.change(screen.getByLabelText('Firm name'), { target: { value: firm.name } }); fireEvent.change(screen.getByLabelText('Firm slug'), { target: { value: firm.slug } }); fireEvent.change(screen.getByLabelText('Initial owner name'), { target: { value: 'Mira Owner' } }); fireEvent.change(screen.getByLabelText('Initial owner email'), { target: { value: 'mira@example.com' } }); fireEvent.change(screen.getByLabelText('Initial password'), { target: { value: 'temporary-password' } }); fireEvent.submit(screen.getByRole('button', { name: 'Create firm' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: firm.name, ownerEmail: 'mira@example.com' })))
  })
  it('confirms and suspends a firm', async () => {
    mocks.firms.mockReturnValue({ isLoading: false, data: { firms: [firm], nextCursor: null } }); mocks.suspend.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ ...firm, status: 'SUSPENDED' }) }); renderDashboard(); fireEvent.click(screen.getByRole('button', { name: 'Suspend firm' })); await vi.waitFor(() => expect(mocks.suspend).toHaveBeenCalledWith('firm-1'))
  })
})
