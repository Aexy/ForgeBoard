import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import * as session from './api/session'
import * as clientApi from './api/clients'
import * as workflowApi from './api/workflows'
import * as activityApi from './api/activity'

vi.mock('./api/session', () => ({
  currentSession: vi.fn(), login: vi.fn(), logout: vi.fn(), createFirm: vi.fn(),
}))
vi.mock('./api/clients', () => ({ listClients: vi.fn(), createClient: vi.fn(), archiveClient: vi.fn() }))
vi.mock('./api/workflows', () => ({ listWorkflows: vi.fn(), getWorkflow: vi.fn(), createWorkflow: vi.fn(), createWorkItem: vi.fn(), moveWorkItem: vi.fn() }))
vi.mock('./api/activity', () => ({ listActivity: vi.fn().mockResolvedValue([]) }))

describe('App', () => {
  beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); vi.mocked(clientApi.listClients).mockResolvedValue([]); vi.mocked(workflowApi.listWorkflows).mockResolvedValue([]); vi.mocked(activityApi.listActivity).mockResolvedValue([]) })

  it('presents the workflow foundation after restoring a firm session', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'No workflow yet' })).toBeInTheDocument()
  })

  it('signs an existing owner in', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(session.login).mockResolvedValue({ email: 'owner@example.com' })
    render(<App />)

    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(session.login).toHaveBeenCalledWith('owner@example.com', 'long-secret-password'))
    expect(await screen.findByRole('heading', { name: 'Select a firm' })).toBeInTheDocument()
  })

  it('creates a firm and starts the owner session', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(session.createFirm).mockResolvedValue({ firmId: 'firm-1', firmSlug: 'ledger-co', ownerId: 'owner-1', ownerEmail: 'owner@ledger.test' })
    vi.mocked(session.login).mockResolvedValue({ email: 'owner@ledger.test' })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Create a firm' }))
    fireEvent.change(screen.getByLabelText('Firm name'), { target: { value: 'Ledger & Co' } })
    fireEvent.change(screen.getByLabelText('Workspace address'), { target: { value: 'ledger-co' } })
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Owner' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@ledger.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create firm' }))

    await waitFor(() => expect(session.createFirm).toHaveBeenCalledWith(expect.objectContaining({ firmName: 'Ledger & Co', firmSlug: 'ledger-co' })))
    expect(await screen.findByText('Ledger & Co')).toBeInTheDocument()
    expect(localStorage.getItem('forgeboard.selectedFirmId')).toBe('firm-1')
  })

  it('lists and archives clients in the selected firm', async () => {
    localStorage.setItem('forgeboard.selectedFirmId', 'firm-1')
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    vi.mocked(clientApi.listClients).mockResolvedValue([{ id: 'client-1', legalName: 'Northstar Studio GmbH', displayName: 'Northstar', primaryEmail: 'hello@northstar.test', status: 'ACTIVE', version: 0 }])
    vi.mocked(clientApi.archiveClient).mockResolvedValue({ id: 'client-1', legalName: 'Northstar Studio GmbH', displayName: 'Northstar', primaryEmail: 'hello@northstar.test', status: 'ARCHIVED', version: 1 })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Clients' }))
    expect(await screen.findByRole('heading', { name: 'Northstar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(clientApi.archiveClient).toHaveBeenCalledWith('firm-1', 'client-1'))
    expect(await screen.findByText('archived')).toBeInTheDocument()
  })
})
