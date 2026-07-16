// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), useGetClientsQuery: vi.fn(), create: vi.fn(), archive: vi.fn() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/store/api', () => ({ useGetClientsQuery: mocks.useGetClientsQuery, useCreateClientMutation: () => [mocks.create, { isLoading: false }], useArchiveClientMutation: () => [mocks.archive] }))
import { Clients } from '@/features/clients/Clients'

const activeClient = { id: 'client-1', displayName: 'Northstar', legalName: 'Northstar Studio GmbH', primaryEmail: 'hello@northstar.test', status: 'ACTIVE', version: 0 }
describe('Clients route feature', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.create.mockReset(); mocks.archive.mockReset() })
  it('shows loading, error, and empty states', () => {
    mocks.useGetClientsQuery.mockReturnValue({ isLoading: true }); const view = render(<Clients />); expect(screen.getByText('Loading clients…')).toBeVisible()
    mocks.useGetClientsQuery.mockReturnValue({ isLoading: false, isError: true }); view.rerender(<Clients />); expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    mocks.useGetClientsQuery.mockReturnValue({ isLoading: false, data: [] }); view.rerender(<Clients />); expect(screen.getByText('No clients yet')).toBeVisible()
  })
  it('creates and archives a client through the firm-scoped mutations', async () => {
    mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(activeClient) }); mocks.archive.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ ...activeClient, status: 'ARCHIVED' }) }); mocks.useGetClientsQuery.mockReturnValue({ isLoading: false, data: [activeClient] })
    render(<Clients />)
    fireEvent.click(screen.getByRole('button', { name: '+ New client' }))
    fireEvent.change(screen.getByLabelText('Legal name'), { target: { value: activeClient.legalName } }); fireEvent.change(screen.getByLabelText('Display name'), { target: { value: activeClient.displayName } }); fireEvent.submit(screen.getByRole('button', { name: 'Save client' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }) })))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await vi.waitFor(() => expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', firm: expect.objectContaining({ firmId: 'firm-1' }) })))
  })
  it('does not render client mutations for a read-only membership', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'READ_ONLY' }); mocks.useGetClientsQuery.mockReturnValue({ isLoading: false, data: [activeClient] })
    render(<Clients />)
    expect(screen.queryByRole('button', { name: '+ New client' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })
})
