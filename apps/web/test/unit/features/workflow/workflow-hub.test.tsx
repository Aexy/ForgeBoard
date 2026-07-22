// @vitest-environment jsdom

import { cleanup, fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firm: vi.fn(), workflows: vi.fn(), create: vi.fn(), push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('@/features/workflow/workflow-transport', () => ({ useGetWorkflowsQuery: mocks.workflows, useCreateWorkflowMutation: () => [mocks.create, { isLoading: false }] }))

import { WorkflowHub } from '@/features/workflow/WorkflowHub'
import { LanguageProvider } from '@/app/LanguageProvider'

const render = (ui: ReactElement) => baseRender(<LanguageProvider initialLanguage="en">{ui}</LanguageProvider>)

describe('WorkflowHub', () => {
  beforeEach(() => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' })
    mocks.workflows.mockReturnValue({ isLoading: false, data: [] })
    mocks.create.mockReset(); mocks.push.mockReset(); mocks.replace.mockReset()
  })
  afterEach(cleanup)

  it.each(['OWNER', 'ADMINISTRATOR', 'MANAGER'] as const)('lets a %s reveal and submit the firm-scoped creation form', async (role) => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role })
    mocks.create.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ id: 'workflow-1', workflowSlug: 'monthly-close' }) })
    render(<WorkflowHub />)
    expect(screen.getByRole('heading', { name: 'No workflow yet' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Create workflow' }))
    fireEvent.change(screen.getByLabelText('Workflow name'), { target: { value: 'Monthly close' } })
    fireEvent.submit(screen.getByRole('heading', { name: 'New workflow' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ firm: expect.objectContaining({ firmId: 'firm-1' }), details: expect.objectContaining({ name: 'Monthly close' }) })))
    expect(mocks.push).toHaveBeenCalledWith('/firms/hearth/workflow/monthly-close')
  })

  it('redirects to the first immutable workflow id', async () => {
    mocks.workflows.mockReturnValue({ isLoading: false, data: [{ id: 'workflow-1', name: 'Monthly close', workflowSlug: 'monthly-close' }] })
    render(<WorkflowHub />)
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/firms/hearth/workflow/monthly-close'))
  })

  it.each(['MEMBER', 'READ_ONLY'] as const)('does not expose creation to %s memberships', (role) => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role })
    render(<WorkflowHub />)
    expect(screen.queryByRole('button', { name: 'Create workflow' })).not.toBeInTheDocument()
    expect(screen.getByText('Only firm owners, administrators, and managers can create workflows.')).toBeVisible()
  })
})
