import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MyWorkDashboard } from './MyWorkDashboard'
import * as employeeDashboard from './api/employeeDashboard'

vi.mock('./api/employeeDashboard', () => ({ employeeDashboardKey: (firmId: string) => ['employee-dashboard', firmId], getMyWorkDashboard: vi.fn() }))

const dashboard = {
  today: '2026-07-15',
  overdue: [],
  dueSoon: [],
  blocked: [{ id: 'item-1', title: 'Prepare July VAT return', workflowId: 'flow-1', stageId: 'stage-1', stageName: 'Client dependency', attention: 'BLOCKED' as const, dueDate: null }],
  awaitingReview: [],
  active: [],
}

function renderDashboard(firmId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { queryClient, ...render(<QueryClientProvider client={queryClient}><MyWorkDashboard firmId={firmId} /></QueryClientProvider>) }
}

describe('MyWorkDashboard', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads the current firm dashboard without a manual refresh control', async () => {
    vi.mocked(employeeDashboard.getMyWorkDashboard).mockResolvedValue(dashboard)
    renderDashboard('firm-1')

    expect(await screen.findByRole('heading', { name: 'Prepare July VAT return' })).toBeInTheDocument()
    expect(employeeDashboard.getMyWorkDashboard).toHaveBeenCalledWith('firm-1')
    expect(screen.queryByRole('button', { name: 'Refresh my work' })).not.toBeInTheDocument()
  })

  it('shows a loading failure without a manual refresh control', async () => {
    vi.mocked(employeeDashboard.getMyWorkDashboard).mockRejectedValueOnce(new Error('unavailable'))
    renderDashboard('firm-1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Your assigned work could not be loaded.')
    expect(screen.queryByRole('button', { name: 'Refresh my work' })).not.toBeInTheDocument()
  })

  it('does not render a prior firm dashboard after the selected firm changes', async () => {
    let resolveSecondFirm: (value: typeof dashboard) => void
    const firstFirmDashboard = { ...dashboard, blocked: [{ ...dashboard.blocked[0], title: 'Firm one work' }] }
    const secondFirmDashboard = { ...dashboard, blocked: [{ ...dashboard.blocked[0], title: 'Firm two work' }] }
    vi.mocked(employeeDashboard.getMyWorkDashboard)
      .mockResolvedValueOnce(firstFirmDashboard)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondFirm = resolve }))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(<QueryClientProvider client={queryClient}><MyWorkDashboard firmId="firm-1" /></QueryClientProvider>)
    expect(await screen.findByRole('heading', { name: 'Firm one work' })).toBeInTheDocument()
    rerender(<QueryClientProvider client={queryClient}><MyWorkDashboard firmId="firm-2" /></QueryClientProvider>)

    await waitFor(() => expect(employeeDashboard.getMyWorkDashboard).toHaveBeenNthCalledWith(2, 'firm-2'))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Firm one work' })).not.toBeInTheDocument())
    resolveSecondFirm!(secondFirmDashboard)

    expect(await screen.findByRole('heading', { name: 'Firm two work' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Firm one work' })).not.toBeInTheDocument()
  })
})
