// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ enrollments: vi.fn(), add: vi.fn(), remove: vi.fn() }))
vi.mock('@/features/engagements/engagements-transport', () => ({
  useGetTemplateEnrollmentsQuery: mocks.enrollments,
  useEnrollTemplateClientsMutation: () => [mocks.add, { isLoading: false }],
  useUnenrollTemplateClientsMutation: () => [mocks.remove, { isLoading: false }],
}))

import { TemplateClientAssignments } from '@/features/engagements/TemplateClientAssignments'

const firm = { firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' as const }
const template = { id: 'template-1', name: 'Monthly bookkeeping', workflowId: 'workflow-1', recurrence: 'MONTHLY' as const, defaultWorkItemTitle: 'Prepare {{period}}', dueDay: 20, version: 1, currentVersion: 1, enrolledClientCount: 1 }
const clients = [
  { id: 'client-1', displayName: 'Northstar', legalName: 'Northstar GmbH', primaryEmail: null, status: 'ACTIVE' as const, version: 0 },
  { id: 'client-2', displayName: 'Bergmann', legalName: 'Bergmann GmbH', primaryEmail: null, status: 'ACTIVE' as const, version: 0 },
  { id: 'client-3', displayName: 'Archived', legalName: 'Archived GmbH', primaryEmail: null, status: 'ARCHIVED' as const, version: 0 },
]

describe('TemplateClientAssignments', () => {
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') }) },
      close: { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute('open') }) },
    })
    mocks.enrollments.mockReturnValue({ data: [clients[0]], isLoading: false, isError: false })
    mocks.add.mockReset(); mocks.remove.mockReset()
    mocks.add.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ enrolledClientCount: 2 }) })
    mocks.remove.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ enrolledClientCount: 0 }) })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })
  afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('opens as a modal and restores the trigger focus when cancelled', () => {
    const onClose = vi.fn(); const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
    render(<TemplateClientAssignments template={template} clients={clients} firm={firm} onClose={onClose} />)
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Clients for Monthly bookkeeping')
    expect(screen.getByRole('button', { name: 'Close client assignments for Monthly bookkeeping' })).toHaveFocus()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
    expect(trigger).toHaveFocus()
  })

  it('filters active clients and the master checkbox selects every matching result', () => {
    render(<TemplateClientAssignments template={template} clients={clients} firm={firm} onClose={vi.fn()} />)
    expect(screen.queryByLabelText('Archived')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search active clients' }), { target: { value: 'berg' } })
    expect(screen.getByText('1 matching client')).toBeVisible()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 1 matching clients' }))
    expect(screen.getByRole('checkbox', { name: 'Bergmann' })).toBeChecked()
  })

  it('requires a count confirmation before adding or removing selected clients', async () => {
    render(<TemplateClientAssignments template={template} clients={clients} firm={firm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Northstar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 selected client' }))
    expect(window.confirm).toHaveBeenCalledWith('Add 1 selected client to Monthly bookkeeping?')
    await vi.waitFor(() => expect(mocks.add).toHaveBeenCalledWith({ firm, templateId: 'template-1', clientIds: ['client-1'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1 selected client' }))
    expect(window.confirm).toHaveBeenCalledWith('Remove 1 selected client from Monthly bookkeeping?')
    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ firm, templateId: 'template-1', clientIds: ['client-1'] }))
  })
})
