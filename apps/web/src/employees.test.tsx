// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), useGetEmployeesQuery: vi.fn(), create: vi.fn() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/features/employees/employees-transport', () => ({ useGetEmployeesQuery: mocks.useGetEmployeesQuery, useCreateEmployeeMutation: () => [mocks.create, { isLoading: false }] }))

import { Employees } from '@/features/employees/Employees'

const employee = { membershipId: 'membership-1', userId: 'user-1', displayName: 'Mira Miller', email: 'mira@example.com', role: 'MEMBER' as const }

describe('Employees route feature', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.useGetEmployeesQuery.mockReset(); mocks.create.mockReset() })

  it('shows loading, error, and empty states for an authorized firm', () => {
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: true })
    const view = render(<Employees />)
    expect(screen.getByText('Loading employees…')).toBeVisible()
    expect(mocks.useGetEmployeesQuery).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }) }), { skip: false })
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, isError: true }); view.rerender(<Employees />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, data: [] }); view.rerender(<Employees />)
    expect(screen.getByText('No employees yet')).toBeVisible()
  })

  it('creates an employee through a firm-scoped mutation', async () => {
    mocks.useGetEmployeesQuery.mockReturnValue({ isLoading: false, data: [employee] })
    mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(employee) })
    render(<Employees />)
    fireEvent.click(screen.getByRole('button', { name: '+ New employee' }))
    fireEvent.change(screen.getByLabelText('Employee name'), { target: { value: employee.displayName } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: employee.email } })
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temporary-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Create employee' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), employee: expect.objectContaining({ email: employee.email, role: 'MEMBER' }) })))
  })

  it('does not issue an employee query for memberships Spring does not authorize', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' })
    mocks.useGetEmployeesQuery.mockReturnValue({})
    render(<Employees />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only owners and administrators')
    expect(mocks.useGetEmployeesQuery).toHaveBeenCalledWith(expect.anything(), { skip: true })
    expect(screen.queryByRole('button', { name: '+ New employee' })).not.toBeInTheDocument()
  })
})
