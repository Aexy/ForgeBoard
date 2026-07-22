// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useFirmContext: vi.fn(), useGetMyWorkQuery: vi.fn() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/features/my-work/my-work-transport', () => ({ useGetMyWorkQuery: mocks.useGetMyWorkQuery }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { MyWorkDashboard } from '@/features/my-work/MyWorkDashboard'
import { LanguageProvider } from '@/app/LanguageProvider'

function renderWithLanguage(language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><MyWorkDashboard /></LanguageProvider>)
}

describe('My Work route feature', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MEMBER' }) })
  it('shows loading and failure states for a direct firm route', () => {
    mocks.useGetMyWorkQuery.mockReturnValue({ isLoading: true })
    const view = renderWithLanguage()
    expect(screen.getByText('Loading your work…')).toBeVisible()
    mocks.useGetMyWorkQuery.mockReturnValue({ isLoading: false, isError: true })
    view.rerender(<LanguageProvider initialLanguage="en"><MyWorkDashboard /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
  })
  it('renders the assigned work groups', () => {
    mocks.useGetMyWorkQuery.mockReturnValue({ isLoading: false, data: { overdue: [{ taskReference: 'FB-1042', workflowSlug: 'monthly-close', title: 'Prepare VAT return', stageName: 'Preparation', dueDate: '2026-07-16' }], dueSoon: [], blocked: [], awaitingReview: [], active: [] } })
    renderWithLanguage()
    expect(screen.getByRole('heading', { name: 'My work' })).toBeVisible()
    expect(screen.getByText('Prepare VAT return')).toBeVisible()
    expect(screen.getByRole('link', { name: /Prepare VAT return/ })).toHaveAttribute('href', '/firms/hearth/workflow/monthly-close/tasks/FB-1042')
  })
  it('renders the German loading and group labels', () => {
    mocks.useGetMyWorkQuery.mockReturnValue({ isLoading: true })
    const view = renderWithLanguage('de')
    expect(screen.getByText('Ihre Aufgaben werden geladen…')).toBeVisible()
    mocks.useGetMyWorkQuery.mockReturnValue({ isLoading: false, data: { overdue: [], dueSoon: [], blocked: [], awaitingReview: [], active: [] } })
    view.rerender(<LanguageProvider initialLanguage="de"><MyWorkDashboard /></LanguageProvider>)
    expect(screen.getByRole('heading', { name: 'Überfällig' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Wartet auf Prüfung' })).toBeVisible()
  })
})
