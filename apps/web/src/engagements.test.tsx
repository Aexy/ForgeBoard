// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useFirmContext: vi.fn(), clients: vi.fn(), workflows: vi.fn(), templates: vi.fn(), engagements: vi.fn(), requests: vi.fn(),
  createTemplate: vi.fn(), createEngagement: vi.fn(), createRequest: vi.fn(), receive: vi.fn(),
}))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.useFirmContext }))
vi.mock('@/features/clients/clients-transport', () => ({ useGetClientsQuery: mocks.clients }))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkflowsQuery: mocks.workflows }))
vi.mock('@/features/engagements/engagements-transport', () => ({
  useGetEngagementTemplatesQuery: mocks.templates, useGetEngagementsQuery: mocks.engagements, useGetDocumentRequestsQuery: mocks.requests,
  useCreateEngagementTemplateMutation: () => [mocks.createTemplate, { isLoading: false }], useCreateEngagementMutation: () => [mocks.createEngagement, { isLoading: false }], useCreateDocumentRequestMutation: () => [mocks.createRequest, { isLoading: false }], useReceiveDocumentRequestMutation: () => [mocks.receive],
}))
import { Engagements } from '@/features/engagements/Engagements'

const client = { id: 'client-1', displayName: 'Northstar', legalName: 'Northstar GmbH', primaryEmail: null, status: 'ACTIVE', version: 0 }
const template = { id: 'template-1', name: 'Monthly bookkeeping', workflowId: 'workflow-1', recurrence: 'MONTHLY', defaultWorkItemTitle: 'Prepare {{period}}', dueDay: 20, version: 0 }

describe('Engagements route feature', () => {
  afterEach(cleanup)
  beforeEach(() => {
    mocks.useFirmContext.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' })
    mocks.clients.mockReturnValue({ isLoading: false, data: [client] }); mocks.workflows.mockReturnValue({ isLoading: false, data: [{ id: 'workflow-1', name: 'Monthly close', version: 0 }] }); mocks.templates.mockReturnValue({ isLoading: false, data: [template] }); mocks.engagements.mockReturnValue({ isLoading: false, data: [] }); mocks.requests.mockReturnValue({ isLoading: false, data: [] })
    mocks.createTemplate.mockReset(); mocks.createEngagement.mockReset(); mocks.createRequest.mockReset(); mocks.receive.mockReset()
  })

  it('shows loading, error, and empty states', () => {
    mocks.engagements.mockReturnValue({ isLoading: true })
    const view = render(<Engagements />)
    expect(screen.getByText('Loading engagements…')).toBeVisible()
    mocks.engagements.mockReturnValue({ isLoading: false, isError: true, data: [] }); view.rerender(<Engagements />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.getByText('No engagements yet')).toBeVisible()
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
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, version: 0 }] })
    render(<Engagements />)
    expect(screen.queryByRole('button', { name: '+ New template' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Start engagement' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Request' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark received' })).not.toBeInTheDocument()
  })

  it('marks a document request received through the firm-scoped mutation', async () => {
    mocks.requests.mockReturnValue({ isLoading: false, data: [{ id: 'request-1', clientId: 'client-1', label: 'Bank statement', externalReference: null, dueDate: null, status: 'REQUESTED', receivedAt: null, version: 0 }] })
    mocks.receive.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'request-1' }) })
    render(<Engagements />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark received' }))
    await vi.waitFor(() => expect(mocks.receive).toHaveBeenCalledWith({ firm: expect.objectContaining({ firmId: 'firm-1' }), requestId: 'request-1' }))
  })
})
