// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  firm: vi.fn(), portfolio: vi.fn(), clients: vi.fn(), templates: vi.fn(), employees: vi.fn(),
}))
const router = { replace: vi.fn(), refresh: vi.fn() }
let search = new URLSearchParams('q=Northstar&attention=OVERDUE&attention=BLOCKED&page=2')

vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => search }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('@/features/portfolio/portfolio-transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./portfolio-transport')>()),
  useGetEngagementPortfolioQuery: mocks.portfolio,
}))
vi.mock('@/features/clients/clients-transport', () => ({ useGetClientsQuery: mocks.clients }))
vi.mock('@/features/engagements/engagements-transport', () => ({ useGetEngagementTemplatesQuery: mocks.templates }))
vi.mock('@/features/employees/employees-transport', () => ({ useGetEmployeesQuery: mocks.employees }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { EngagementPortfolio, portfolioSearchFromParams } from './EngagementPortfolio'

const render = (ui: ReactElement) => baseRender(<LanguageProvider initialLanguage="en">{ui}</LanguageProvider>)
const item = { id: 'engagement-1', clientId: 'client-1', clientName: 'Northstar GmbH', templateId: 'template-1', templateName: 'Monthly bookkeeping', templateVersion: 3, preparerUserId: null, preparerName: null, reviewerUserId: 'user-2', reviewerName: 'Taylor', periodStart: '2026-07-01', periodEnd: '2026-07-31', dueDate: '2026-08-20', status: 'BLOCKED' as const, workflowSlug: 'monthly-close', taskReference: 'FB-1042', attention: ['OVERDUE', 'BLOCKED'] as const }

describe('EngagementPortfolio', () => {
  beforeEach(() => {
    search = new URLSearchParams('q=Northstar&attention=OVERDUE&attention=BLOCKED&page=2')
    router.replace.mockReset()
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' })
    mocks.portfolio.mockReturnValue({ isLoading: false, data: { content: [item], page: 2, pageSize: 25, totalElements: 76, totalPages: 4 } })
    mocks.clients.mockReturnValue({ data: [{ id: 'client-1', displayName: 'Northstar GmbH', status: 'ACTIVE' }] })
    mocks.templates.mockReturnValue({ data: [{ id: 'template-1', name: 'Monthly bookkeeping' }] })
    mocks.employees.mockReturnValue({ data: [{ membershipId: 'membership-1', userId: 'user-2', displayName: 'Taylor', email: 'taylor@example.com', status: 'ACTIVE' }] })
  })
  afterEach(cleanup)

  it('hydrates valid shareable filters and rejects invalid dates or unknown attention values', () => {
    expect(portfolioSearchFromParams(new URLSearchParams('periodStart=2026-07-31&periodEnd=2026-07-01&attention=OVERDUE&attention=UNKNOWN&size=999'))).toMatchObject({ attention: ['OVERDUE'], size: 25 })
    expect(portfolioSearchFromParams(search)).toMatchObject({ q: 'Northstar', attention: ['OVERDUE', 'BLOCKED'], page: 2 })
  })

  it('keeps the route query authoritative and renders every overlapping badge with the task link', () => {
    render(<EngagementPortfolio basePath="/firms/hearth/portfolio" />)
    expect(mocks.portfolio).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), filters: expect.objectContaining({ attention: ['OVERDUE', 'BLOCKED'] }), page: 2 }), expect.objectContaining({ skip: false }))
    expect(screen.getByText('Overdue', { selector: 'span' })).toBeVisible()
    expect(screen.getByText('Blocked', { selector: 'span' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open task' })).toHaveAttribute('href', '/firms/hearth/workflow/monthly-close/tasks/FB-1042')
    fireEvent.change(screen.getByLabelText('Search engagements'), { target: { value: 'Acme' } })
    expect(router.replace).toHaveBeenLastCalledWith('/firms/hearth/portfolio?q=Acme&attention=OVERDUE&attention=BLOCKED')
  })

  it('uses attention as an OR multi-select and returns to the first page on a filter change', () => {
    render(<EngagementPortfolio basePath="/firms/hearth/portfolio" />)
    fireEvent.click(screen.getByLabelText('Due Soon'))
    expect(router.replace).toHaveBeenLastCalledWith('/firms/hearth/portfolio?q=Northstar&attention=OVERDUE&attention=BLOCKED&attention=DUE_SOON')
  })

  it('does not issue portfolio or supporting queries to an administrator', () => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'ADMINISTRATOR' })
    render(<EngagementPortfolio basePath="/firms/hearth/portfolio" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only firm owners and managers')
    expect(mocks.portfolio).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ skip: true }))
    expect(mocks.clients).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ skip: true }))
  })

  it('refreshes on return and focus without removing rows or resetting the selected filters', () => {
    const previous = mocks.portfolio.getMockImplementation()!()
    mocks.portfolio.mockReturnValue({ ...previous, isFetching: true })
    render(<EngagementPortfolio basePath="/firms/hearth/portfolio" />)
    expect(screen.getByRole('status')).toHaveTextContent('Updating')
    expect(screen.getByRole('link', { name: 'Open task' })).toBeVisible()
    expect(screen.getByLabelText('Search engagements')).toHaveValue('Northstar')
    expect(mocks.portfolio).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }), {
      skip: false, refetchOnMountOrArgChange: true, refetchOnFocus: true,
    })
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('retains the existing failure message when a background refresh fails', () => {
    mocks.portfolio.mockReturnValue({ isLoading: false, isFetching: false, isError: true })
    render(<EngagementPortfolio basePath="/firms/hearth/portfolio" />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })
})
