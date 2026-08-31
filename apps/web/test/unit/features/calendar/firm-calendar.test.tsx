// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firm: vi.fn(), calendar: vi.fn(), create: vi.fn(), remove: vi.fn() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('@/features/calendar/firm-calendar-transport', () => ({
  useGetFirmCalendarQuery: mocks.calendar,
  useCreateFirmClosureMutation: () => [mocks.create, { isLoading: false }],
  useDeleteFirmClosureMutation: () => [mocks.remove, { isLoading: false }],
}))

import { FirmCalendar } from '@/features/calendar/FirmCalendar'

const firm = { firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' as const }
const closure = { id: 'closure-1', closureDate: '2026-12-24', label: 'Year-end closure' }

describe('firm calendar', () => {
  beforeEach(() => {
    mocks.firm.mockReturnValue(firm)
    mocks.calendar.mockReturnValue({ isLoading: false, data: { timezone: 'Europe/Vienna', year: 2026, statutoryHolidays: [{ date: '2026-01-01', label: 'New Year' }], closures: [closure] } })
    mocks.create.mockReset(); mocks.remove.mockReset()
    mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(closure) })
    mocks.remove.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(undefined) })
  })
  afterEach(cleanup)

  it('shows statutory holidays separately from editable firm closures', () => {
    render(<FirmCalendar />)
    expect(screen.getByRole('heading', { name: 'Austrian public holidays' })).toBeVisible()
    expect(screen.getByText('New Year')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Firm closures' })).toBeVisible()
    expect(screen.getByText('Year-end closure')).toBeVisible()
    expect(screen.getByText('Europe/Vienna')).toBeVisible()
  })

  it('sends firm-scoped closure creation and optimistic deletion requests', async () => {
    render(<FirmCalendar />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-24' } })
    fireEvent.change(screen.getByLabelText('Closure name'), { target: { value: 'Year-end closure' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add closure' }))
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ firm, closure: { closureDate: '2026-12-24', label: 'Year-end closure' } })))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ firm, closureId: 'closure-1' })))
  })

  it.each(['MEMBER', 'READ_ONLY'] as const)('does not query or expose calendar management to %s memberships', (role) => {
    mocks.firm.mockReturnValue({ ...firm, role })
    render(<FirmCalendar />)
    expect(mocks.calendar).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ role }) }), { skip: true })
    expect(screen.getByRole('alert')).toHaveTextContent('Only owners, administrators, and managers')
    expect(screen.queryByRole('button', { name: 'Add closure' })).not.toBeInTheDocument()
  })
})
