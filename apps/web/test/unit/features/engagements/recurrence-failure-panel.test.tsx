// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firm: vi.fn(), failures: vi.fn(), retry: vi.fn(), solved: vi.fn(), generate: vi.fn() }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('@/features/engagements/engagements-transport', () => ({
  useGetRecurrenceFailuresQuery: mocks.failures,
  useRetryRecurrenceFailureMutation: () => [mocks.retry, { isLoading: false }],
  useMarkRecurrenceFailureSolvedMutation: () => [mocks.solved, { isLoading: false }],
  useGenerateRecurrenceFailureMutation: () => [mocks.generate, { isLoading: false }],
}))
import { RecurrenceFailurePanel } from '@/features/engagements/RecurrenceFailurePanel'

const failure = { id: 'run-1', templateId: 'template-1', templateName: 'Monthly VAT', periodStart: '2026-07-01', failedDefinitionVersion: 1, currentDefinitionVersion: 2, failureDetail: 'Could not create work item', automaticRetryAttempted: false, generateNowDisabled: true }
describe('RecurrenceFailurePanel', () => {
  beforeEach(() => { mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }); mocks.failures.mockReturnValue({ isLoading: false, data: [failure] }); mocks.retry.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }); mocks.solved.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }); mocks.generate.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }) })
  it('keeps recovery owner-only and requires retry before generation after a definition change', () => {
    const view = render(<RecurrenceFailurePanel />)
    expect(screen.getByRole('button', { name: 'Generate now' })).toBeDisabled()
    expect(screen.getByText('Retry once before generating from the updated template definition.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'More recovery actions for Monthly VAT' }))
    expect(screen.getByRole('button', { name: 'Mark solved' })).toBeVisible()
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' })
    view.unmount()
    render(<RecurrenceFailurePanel />)
    expect(screen.queryByText('Recurring generation needs attention')).not.toBeInTheDocument()
  })
})
