import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import * as session from './api/session'
import * as clientApi from './api/clients'
import * as workflowApi from './api/workflows'
import * as activityApi from './api/activity'
import * as engagementApi from './api/engagements'
import * as documentApi from './api/documentRequests'
import * as employeeDashboardApi from './api/employeeDashboard'
import { LanguageProvider } from './i18n'

vi.mock('./api/session', () => ({
  currentSession: vi.fn(), login: vi.fn(), logout: vi.fn(), createFirm: vi.fn(), listAccessibleFirms: vi.fn(),
}))
vi.mock('./api/clients', () => ({ listClients: vi.fn(), createClient: vi.fn(), archiveClient: vi.fn() }))
vi.mock('./api/workflows', () => ({ listWorkflows: vi.fn(), getWorkflow: vi.fn(), createWorkflow: vi.fn(), createWorkItem: vi.fn(), moveWorkItem: vi.fn() }))
vi.mock('./api/activity', () => ({ listActivity: vi.fn().mockResolvedValue([]) }))
vi.mock('./api/engagements', () => ({ listEngagements: vi.fn(), listEngagementTemplates: vi.fn(), createEngagementTemplate: vi.fn(), createEngagementInstance: vi.fn() }))
vi.mock('./api/documentRequests', () => ({ listDocumentRequests: vi.fn(), createDocumentRequest: vi.fn(), markDocumentRequestReceived: vi.fn() }))
vi.mock('./api/employeeDashboard', () => ({ employeeDashboardKey: (firmId: string) => ['employee-dashboard', firmId], getMyWorkDashboard: vi.fn() }))

function renderApp() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LanguageProvider><App /></LanguageProvider></QueryClientProvider>)
}

describe('App', () => {
  beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); vi.mocked(session.listAccessibleFirms).mockResolvedValue([]); vi.mocked(clientApi.listClients).mockResolvedValue([]); vi.mocked(workflowApi.listWorkflows).mockResolvedValue([]); vi.mocked(activityApi.listActivity).mockResolvedValue([]); vi.mocked(engagementApi.listEngagements).mockResolvedValue([]); vi.mocked(engagementApi.listEngagementTemplates).mockResolvedValue([]); vi.mocked(documentApi.listDocumentRequests).mockResolvedValue([]); vi.mocked(employeeDashboardApi.getMyWorkDashboard).mockResolvedValue({ today: '2026-07-15', overdue: [], dueSoon: [], blocked: [], awaitingReview: [], active: [] }) })

  it('switches the access screen to German and persists the choice', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Deutsch' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Willkommen zurück' })).toBeInTheDocument())
    expect(localStorage.getItem('forgeboard.language')).toBe('de')
  })

  it('presents the workflow foundation after restoring a firm session', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'OWNER' }])
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'No workflow yet' })).toBeInTheDocument()
    expect(screen.getByText('Hearth Accounting')).toBeInTheDocument()
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('opens mobile navigation from Menu and closes it after selecting a view', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'OWNER' }])
    renderApp()

    const menu = await screen.findByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toHaveAttribute('data-mobile-open', 'false')

    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toHaveAttribute('data-mobile-open', 'true')
    expect(screen.getByRole('button', { name: 'Sign out on mobile' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'My work' }))
    expect(await screen.findByRole('heading', { name: 'My work' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toHaveAttribute('data-mobile-open', 'false')
  })

  it('signs an existing owner in', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(session.login).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'OWNER' }])
    renderApp()

    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(session.login).toHaveBeenCalledWith('owner@example.com', 'long-secret-password'))
    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeInTheDocument()
    expect(localStorage.getItem('forgeboard.selectedFirmId')).toBe('firm-1')
  })

  it('defaults to sign-in and switches to firm creation from the mobile prompt', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    renderApp()

    expect(await screen.findByText('ForgeBoard')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create a firm from sign-in' }))
    expect(await screen.findByRole('heading', { name: 'Build your workspace' })).toBeInTheDocument()
    expect(screen.getByLabelText('Firm name')).toBeInTheDocument()
    expect(screen.getByText('Already have an account?')).toBeInTheDocument()
  })

  it('creates a firm and starts the owner session', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(session.createFirm).mockResolvedValue({ firmId: 'firm-1', firmSlug: 'ledger-co', ownerId: 'owner-1', ownerEmail: 'owner@ledger.test' })
    vi.mocked(session.login).mockResolvedValue({ email: 'owner@ledger.test' })
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Create a firm' }))
    fireEvent.change(screen.getByLabelText('Firm name'), { target: { value: 'Ledger & Co' } })
    fireEvent.change(screen.getByLabelText('Workspace address'), { target: { value: 'ledger-co' } })
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Owner' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@ledger.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-secret-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long-secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create firm' }))

    await waitFor(() => expect(session.createFirm).toHaveBeenCalledWith(expect.objectContaining({ firmName: 'Ledger & Co', firmSlug: 'ledger-co' })))
    expect(await screen.findByText('Ledger & Co')).toBeInTheDocument()
    expect(localStorage.getItem('forgeboard.selectedFirmId')).toBe('firm-1')
  })

  it('reveals passwords and rejects a mismatched firm-creation confirmation', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Create a firm' }))
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0])
    expect(password).toHaveAttribute('type', 'text')

    fireEvent.change(password, { target: { value: 'long-secret-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-secret-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Create firm' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(session.createFirm).not.toHaveBeenCalled()
  })

  it('lists and archives clients in the selected firm', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(clientApi.listClients).mockResolvedValue([{ id: 'client-1', legalName: 'Northstar Studio GmbH', displayName: 'Northstar', primaryEmail: 'hello@northstar.test', status: 'ACTIVE', version: 0 }])
    vi.mocked(clientApi.archiveClient).mockResolvedValue({ id: 'client-1', legalName: 'Northstar Studio GmbH', displayName: 'Northstar', primaryEmail: 'hello@northstar.test', status: 'ARCHIVED', version: 1 })
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Clients' }))
    expect(await screen.findByRole('heading', { name: 'Northstar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(clientApi.archiveClient).toHaveBeenCalledWith('firm-1', 'client-1'))
    expect(await screen.findByText('archived')).toBeInTheDocument()
  })

  it('opens the engagement workspace and explains its setup requirements', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'OWNER' }])
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Engagements' }))
    expect(await screen.findByRole('heading', { name: 'Engagements' })).toBeInTheDocument()
    expect(screen.getByText(/Create at least one active client/)).toBeInTheDocument()
    expect(documentApi.listDocumentRequests).toHaveBeenCalledWith('firm-1')
  })

  it('opens My work for a restored member session in the selected firm', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'member@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'MEMBER' }])
    renderApp()

    expect(await screen.findByRole('heading', { name: 'My work' })).toBeInTheDocument()
    expect(employeeDashboardApi.getMyWorkDashboard).toHaveBeenCalledWith('firm-1')
  })

  it('shows the audit trail only to owners and managers', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'manager@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'MANAGER' }])
    renderApp()
    expect(await screen.findByRole('button', { name: 'Audit trail' })).toBeInTheDocument()
  })

  it('keeps template creation available when document requests cannot be loaded', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(session.listAccessibleFirms).mockResolvedValue([{ id: 'firm-1', name: 'Hearth Accounting', slug: 'hearth', role: 'OWNER' }])
    vi.mocked(workflowApi.listWorkflows).mockResolvedValue([{ id: 'workflow-1', name: 'Bookkeeping' }])
    vi.mocked(documentApi.listDocumentRequests).mockRejectedValue(new Error('temporarily unavailable'))
    vi.mocked(engagementApi.createEngagementTemplate).mockResolvedValue({ id: 'template-1', name: 'Monthly bookkeeping', workflowId: 'workflow-1', recurrence: 'MONTHLY', defaultWorkItemTitle: 'Prepare {{period}}', dueDay: 20, version: 0 })
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Engagements' }))
    const newTemplate = await screen.findByRole('button', { name: '+ New template' })
    expect(newTemplate).toBeEnabled()
    fireEvent.click(newTemplate)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Monthly bookkeeping' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Workflow' }), { target: { value: 'workflow-1' } })
    fireEvent.change(screen.getByLabelText('Default work item'), { target: { value: 'Prepare {{period}}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }))

    await waitFor(() => expect(engagementApi.createEngagementTemplate).toHaveBeenCalledWith('firm-1', expect.objectContaining({
      name: 'Monthly bookkeeping', workflowId: 'workflow-1', defaultWorkItemTitle: 'Prepare {{period}}',
    })))
    expect(screen.getByText(/Some data could not be loaded: document requests/)).toBeInTheDocument()
  })
})
