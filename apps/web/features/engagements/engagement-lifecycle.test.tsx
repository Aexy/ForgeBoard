// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firm: vi.fn(), change: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/store/firm-cache-boundary', () => ({ useFirmContext: mocks.firm }))
vi.mock('./engagements-transport', async (importOriginal) => ({ ...(await importOriginal<typeof import('./engagements-transport')>()), useChangeEngagementLifecycleMutation: () => [mocks.change, { isLoading: false }] }))
import { EngagementHistory } from './EngagementHistory'
import { EngagementLifecycleControls } from './EngagementLifecycleControls'
import { LanguageProvider } from '@/app/LanguageProvider'

const engagement = { id: 'eng-1', templateId: 'template-1', clientId: 'client-1', workflowId: 'flow-1', workItemId: 'item-1', periodStart: '2026-07-01', periodEnd: '2026-07-31', dueDate: '2026-08-20', status: 'COMPLETE' as const, statusChangedAt: '2026-07-24T10:00:00Z', version: 2 }
describe('engagement lifecycle UI', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.change.mockReset(); mocks.change.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }); vi.stubGlobal('confirm', () => true) })
  it('renders decision history and exposes lifecycle controls only to owners/managers', () => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MEMBER' })
    const view = render(<LanguageProvider initialLanguage="en"><EngagementLifecycleControls engagement={engagement} /><EngagementHistory detail={{ engagement, history: { reviewDecisions: [{ id: 'review-1', actorId: 'user-1', decision: 'RETURNED', note: 'Need bank statement', occurredAt: '2026-07-24T09:00:00Z' }] } }} /></LanguageProvider>)
    expect(screen.getByText('Returned')).toBeVisible(); expect(screen.getByText('Need bank statement')).toBeVisible(); expect(screen.queryByRole('button', { name: 'Archive engagement' })).not.toBeInTheDocument()
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' }); view.rerender(<LanguageProvider initialLanguage="en"><EngagementLifecycleControls engagement={engagement} /></LanguageProvider>)
    expect(screen.getByRole('button', { name: 'Archive engagement' })).toBeVisible(); expect(screen.getByRole('button', { name: 'Reopen engagement' })).toBeVisible()
  })
  it('shows a user-visible error when reopening is rejected', async () => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' })
    mocks.change.mockReturnValue({ unwrap: vi.fn().mockRejectedValue(new Error('conflict')) })
    render(<LanguageProvider initialLanguage="en"><EngagementLifecycleControls engagement={engagement} /></LanguageProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Reopen engagement' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be updated')
  })
  it('formats review timestamps with the selected locale', () => {
    mocks.firm.mockReturnValue({ firmId: 'firm-1', firmSlug: 'hearth', role: 'MEMBER' })
    const locale = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('localized')
    const detail = { engagement, history: { reviewDecisions: [{ id: 'review-1', actorId: 'user-1', decision: 'APPROVED' as const, note: null, occurredAt: '2026-07-24T09:00:00Z' }] } }
    const view = render(<LanguageProvider initialLanguage="en"><EngagementHistory detail={detail} /></LanguageProvider>)
    expect(locale).toHaveBeenLastCalledWith('en-US')
    view.rerender(<LanguageProvider key="de" initialLanguage="de"><EngagementHistory detail={detail} /></LanguageProvider>)
    expect(locale).toHaveBeenLastCalledWith('de-DE')
    locale.mockRestore()
  })
})
