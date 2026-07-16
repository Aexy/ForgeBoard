import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmployeesView } from './EmployeesView'
import * as employees from './api/employees'

vi.mock('./api/employees', () => ({
  createEmployee: vi.fn(),
  listEmployees: vi.fn(),
}))

const firmOneEmployees = [{
  membershipId: 'membership-1',
  userId: 'user-1',
  displayName: 'Firm one employee',
  email: 'one@example.com',
  role: 'MEMBER' as const,
}]

describe('EmployeesView', () => {
  it('does not show prior-firm employees while the next directory is loading', async () => {
    let resolveFirst!: (value: typeof firmOneEmployees) => void
    let resolveSecond!: (value: typeof firmOneEmployees) => void
    vi.mocked(employees.listEmployees)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    const { rerender } = render(<EmployeesView firmId="firm-1" />)
    resolveFirst(firmOneEmployees)
    expect(await screen.findByRole('heading', { name: 'Firm one employee' })).toBeInTheDocument()

    rerender(<EmployeesView firmId="firm-2" />)
    expect(screen.queryByRole('heading', { name: 'Firm one employee' })).not.toBeInTheDocument()
    expect(screen.getByText('Loading employees…')).toBeInTheDocument()

    resolveSecond([{ ...firmOneEmployees[0], displayName: 'Firm two employee' }])
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Firm two employee' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Firm one employee' })).not.toBeInTheDocument()
  })
})
