// @vitest-environment jsdom

import { cleanup, fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useFirmContext: vi.fn(), clients: vi.fn(), workflows: vi.fn(), templates: vi.fn(), engagements: vi.fn(), requests: vi.fn(),
  createTemplate: vi.fn(), createEngagement: vi.fn(), createRequest: vi.fn(), receive: vi.fn(), remind: vi.fn(), escalate: vi.fn(),
  updateTemplate: vi.fn(), enrolledClients: vi.fn(),
  recurrenceFailures: vi.fn(), retryRecurrence: vi.fn(), markRecurrenceSolved: vi.fn(), generateRecurrence: vi.fn(),
}))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/features/clients/clients-transport', () => ({ useGetClientsQuery: mocks.clients }))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkflowsQuery: mocks.workflows }))
vi.mock('@/features/engagements/engagements-transport', () => ({
  useGetEngagementTemplatesQuery: mocks.templates, useGetEngagementsQuery: mocks.engagements, useGetDocumentRequestsQuery: mocks.requests,
  useCreateEngagementTemplateMutation: () => [mocks.createTemplate, { isLoading: false }], useCreateEngagementMutation: () => [mocks.createEngagement, { isLoading: false }], useCreateDocumentRequestMutation: () => [mocks.createRequest, { isLoading: false }], useReceiveDocumentRequestMutation: () => [mocks.receive], useRecordDocumentRequestReminderMutation: () => [mocks.remind], useEscalateDocumentRequestMutation: () => [mocks.escalate],
  useUpdateEngagementTemplateMutation: () => [mocks.updateTemplate, { isLoading: false }],
  useGetTemplateEnrollmentsQuery: mocks.enrolledClients,
  useGetRecurrenceFailuresQuery: mocks.recurrenceFailures,
  useRetryRecurrenceFailureMutation: () => [mocks.retryRecurrence, { isLoading: false }],
  useMarkRecurrenceFailureSolvedMutation: () => [mocks.markRecurrenceSolved, { isLoading: false }],
  useGenerateRecurrenceFailureMutation: () => [mocks.generateRecurrence, { isLoading: false }],
}))
import { Engagements } from '@/features/engagements/Engagements'
import { LanguageProvider } from '@/app/LanguageProvider'

const render = (ui: ReactElement, language: 'en' | 'de' = 'en') => baseRender(<LanguageProvider initialLanguage={language}>{ui}</LanguageProvider>)

const client = { id: 'client-1', displayName: 'Northstar', legalName: 'Northstar GmbH', primaryEmail: null, status: 'ACTIVE', version: 0 }
const template = { id: 'template-1', name: 'Monthly bookkeeping', workflowId: 'workflow-1', recurrence: 'MONTHLY', defaultWorkItemTitle: 'Prepare {{period}}', dueDay: 20, version: 1, currentVersion: 1, enrolledClientCount: 0 }
const secondTemplate = { ...template, id: 'template-2', name: 'Annual accounts', recurrence: 'ANNUAL' as const, defaultWorkItemTitle: 'Prepare annual accounts', dueDay: 28, version: 4, currentVersion: 2 }
const unassignedClient = { ...client, id: 'client-2', displayName: 'Bergmann' }

describe('Engagements route feature', () => {
  afterEach(cleanup)
  beforeEach(() => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' })
    mocks.recurrenceFailures.mockReturnValue({ isLoading: false, data: [] })
    mocks.clients.mockReturnValue({ isLoading: false, data: [client] }); mocks.workflows.mockReturnValue({ isLoading: false, data: [{ id: 'workflow-1', name: 'Monthly close', version: 0 }] }); mocks.templates.mockReturnValue({ isLoading: false, data: [template] }); mocks.engagements.mockReturnValue({ isLoading: false, data: [] }); mocks.requests.mockReturnValue({ isLoading: false, data: [] }); mocks.enrolledClients.mockReturnValue({ isLoading: false, data: [client] })
    mocks.createTemplate.mockReset(); mocks.createEngagement.mockReset(); mocks.createRequest.mockReset(); mocks.receive.mockReset(); mocks.remind.mockReset(); mocks.escalate.mockReset()
  })

  it('shows loading, error, and empty states', () => {
    mocks.engagements.mockReturnValue({ isLoading: true })
    const view = render(<Engagements />)
    expect(screen.getByText('Loading engagements…')).toBeVisible()
    mocks.engagements.mockReturnValue({ isLoading: false, isError: true, data: [] }); view.rerender(<LanguageProvider initialLanguage="en"><Engagements /></LanguageProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.getByText('No engagements yet')).toBeVisible()
  })

  it('keeps API values while rendering German engagement controls', () => {
    render(<Engagements />, 'de')
    expect(screen.getByRole('heading', { name: 'Aufträge' })).toBeVisible()
    expect(screen.getByRole('button', { name: '+ Neue Vorlage' })).toBeVisible()
  })

  it('creates firm-scoped templates, engagements, and metadata-only document requests', async () => {
    mocks.createTemplate.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(template) }); mocks.createEngagement.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'engagement-1' }) }); mocks.createRequest.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'request-1' }) })
    render(<Engagements />)
    fireEvent.click(screen.getByRole('button', { name: '+ New template' })); fireEvent.change(screen.getByLabelText('Name'), { target: { value: template.name } }); fireEvent.change(screen.getByLabelText('Default work item'), { target: { value: template.defaultWorkItemTitle } }); fireEvent.submit(screen.getByRole('button', { name: 'Save template' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }) })))
    await vi.waitFor(() => expect(screen.queryByText('New engagement template')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '+ Start engagement' })); fireEvent.change(screen.getByLabelText('Template'), { target: { value: template.id } }); fireEvent.change(screen.getByLabelText('Client'), { target: { value: client.id } }); fireEvent.submit(screen.getByRole('button', { name: 'Start engagement' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.createEngagement).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), templateId: 'template-1', details: expect.objectContaining({ clientId: 'client-1' }) })))
    await vi.waitFor(() => expect(screen.queryByText('Start an engagement')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '+ Request' })); fireEvent.change(screen.getByLabelText('Client'), { target: { value: client.id } }); fireEvent.change(screen.getByLabelText('Request'), { target: { value: 'Bank statement' } }); fireEvent.submit(screen.getByRole('button', { name: 'Send request' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.createRequest).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), request: expect.objectContaining({ label: 'Bank statement', clientId: 'client-1' }) })))
  })

  it('does not render mutations for read-only memberships', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'READ_ONLY' })
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, followUpState: 'OPEN', remindedAt: null, escalatedAt: null, version: 0 }] })
    render(<Engagements />)
    expect(screen.queryByRole('button', { name: '+ New template' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Start engagement' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Request' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark received' })).not.toBeInTheDocument()
  })

  it.each(['MEMBER', 'READ_ONLY'] as const)('does not expose template definition or client assignments to %s memberships', (role) => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role })
    render(<Engagements />)
    expect(screen.queryByRole('button', { name: 'Edit template Monthly bookkeeping' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage clients for Monthly bookkeeping' })).not.toBeInTheDocument()
  })

  it.each(['OWNER', 'ADMINISTRATOR', 'MANAGER'] as const)('exposes template definition and client assignments to %s memberships', (role) => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role })
    render(<Engagements />)
    expect(screen.getByRole('button', { name: 'Edit template Monthly bookkeeping' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Manage clients for Monthly bookkeeping' })).toBeVisible()
  })

  it('resets the template definition form when switching to edit a different template', () => {
    mocks.templates.mockReturnValue({ isLoading: false, data: [template, secondTemplate] })
    render(<Engagements />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit template Monthly bookkeeping' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved monthly edit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit template Annual accounts' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Annual accounts')
    expect(screen.getByLabelText('Default work item')).toHaveValue('Prepare annual accounts')
  })

  it('offers only active clients enrolled in the selected template and explains an empty enrollment', () => {
    mocks.clients.mockReturnValue({ isLoading: false, data: [client, unassignedClient] })
    mocks.templates.mockReturnValue({ isLoading: false, data: [template, secondTemplate] })
    mocks.enrolledClients.mockReturnValue({ isLoading: false, data: [client] })
    render(<Engagements />)
    fireEvent.click(screen.getByRole('button', { name: '+ Start engagement' }))
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: template.id } })
    expect(screen.getByRole('option', { name: 'Northstar' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Bergmann' })).not.toBeInTheDocument()
    mocks.enrolledClients.mockReturnValue({ isLoading: false, data: [] })
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: secondTemplate.id } })
    expect(screen.getByText('No active clients are enrolled for this template. Manage its clients before starting an engagement.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start engagement' })).toBeDisabled()
  })

  it('marks a document request received through the firm-scoped mutation', async () => {
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, followUpState: 'OPEN', remindedAt: null, escalatedAt: null, version: 0 }] })
    mocks.receive.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'request-1' }) })
    render(<Engagements />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark received' }))
    await vi.waitFor(() => expect(mocks.receive).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), requestId: 'request-1' }))
  })

  it('records then escalates an outstanding request through its firm-scoped mutations', async () => {
    const request = { id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, version: 0 }
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ ...request, followUpState: 'OPEN', remindedAt: null, escalatedAt: null }] })
    mocks.remind.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(request) })
    const view = render(<Engagements />)

    expect(screen.getByText('open')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Record reminder' }))
    await vi.waitFor(() => expect(mocks.remind).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), requestId: 'request-1' }))

    mocks.requests.mockReturnValue({ isLoading: false, data: [{ ...request, followUpState: 'REMINDER_RECORDED', remindedAt: '2026-08-31T09:00:00Z', escalatedAt: null }] })
    mocks.escalate.mockReturnValue({ unwrap: vi.fn().mockResolvedValue(request) })
    view.rerender(<LanguageProvider initialLanguage="en"><Engagements /></LanguageProvider>)
    expect(screen.getByText('reminder recorded')).toBeVisible()
    expect(screen.getByText(/Reminder recorded/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Escalate' }))
    await vi.waitFor(() => expect(mocks.escalate).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), requestId: 'request-1' }))
  })

  it('hides follow-up controls from read-only memberships', () => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'READ_ONLY' })
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, followUpState: 'OPEN', remindedAt: null, escalatedAt: null, version: 0 }] })
    render(<Engagements />)
    expect(screen.queryByRole('button', { name: 'Record reminder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Escalate' })).not.toBeInTheDocument()
  })

  it('shows the request error treatment when recording a reminder fails', async () => {
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, followUpState: 'OPEN', remindedAt: null, escalatedAt: null, version: 0 }] })
    mocks.remind.mockReturnValue({ unwrap: vi.fn().mockRejectedValue(new Error('failed')) })
    render(<Engagements />)

    fireEvent.click(screen.getByRole('button', { name: 'Record reminder' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The document request follow-up could not be updated.')
  })

  it('keeps receipt available without more follow-up actions after escalation', () => {
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, followUpState: 'ESCALATED', remindedAt: '2026-08-31T09:00:00Z', escalatedAt: '2026-08-31T10:00:00Z', version: 2 }] })
    render(<Engagements />)

    expect(screen.getByText('escalated')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Record reminder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Escalate' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark received' })).toBeVisible()
  })
})
