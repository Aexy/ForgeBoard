import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import * as session from './api/session'

vi.mock('./api/session', () => ({
  currentSession: vi.fn(), login: vi.fn(), logout: vi.fn(), createFirm: vi.fn(),
}))

describe('App', () => {
  beforeEach(() => vi.resetAllMocks())

  it('presents the accounting workflow after restoring a session', async () => {
    vi.mocked(session.currentSession).mockResolvedValue({ email: 'owner@example.com' })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Monthly accounting' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Monthly accounting workflow' })).toBeInTheDocument()
  })

  it('signs an existing owner in', async () => {
    vi.mocked(session.currentSession).mockRejectedValue(new Error('unauthenticated'))
    vi.mocked(session.login).mockResolvedValue({ email: 'owner@example.com' })
    render(<App />)

    fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(session.login).toHaveBeenCalledWith('owner@example.com', 'long-secret-password'))
    expect(await screen.findByRole('heading', { name: 'Monthly accounting' })).toBeInTheDocument()
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
  })
})
