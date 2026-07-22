// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const router = { replace: vi.fn(), push: vi.fn(), back: vi.fn() }
let search = new URLSearchParams('priority=URGENT&unassigned=true')
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => search }))

import { WorkflowFilters, filtersFromSearch } from '@/features/workflow/WorkflowFilters'
import { LanguageProvider } from '@/app/LanguageProvider'

const render = (ui: ReactElement, language: 'en' | 'de' = 'en') => baseRender(<LanguageProvider initialLanguage={language}>{ui}</LanguageProvider>)

describe('workflow route state', () => {
  afterEach(() => { cleanup(); localStorage.clear() })
  it('hydrates filters from the shareable board query', () => {
    expect(filtersFromSearch(search)).toEqual({ client: '', owner: '', due: '', priority: 'URGENT', unassigned: true })
  })

  it('replaces the board URL when a filter changes', () => {
    render(<WorkflowFilters basePath="/firms/hearth/workflow/flow-1" />)
    fireEvent.change(screen.getByLabelText('Due state'), { target: { value: 'soon' } })
    expect(router.replace).toHaveBeenCalledWith('/firms/hearth/workflow/flow-1?priority=URGENT&unassigned=true&due=soon')
  })

  it('uses the shared German preference for workflow filters', async () => {
    render(<WorkflowFilters basePath="/firms/hearth/workflow/flow-1" />, 'de')
    expect(await screen.findByText('Fälligkeitsstatus')).toBeInTheDocument()
    expect(screen.getByText('Filter zurücksetzen')).toBeInTheDocument()
  })

  it('applies a saved view through a replace URL without retaining a task panel', () => {
    search = new URLSearchParams('task=task-1')
    render(<WorkflowFilters basePath="/firms/hearth/workflow/flow-1" savedViews={[{ id: 'view-1', name: 'Urgent unassigned', clientId: null, ownerUserId: null, dueState: 'OVERDUE', priority: 'URGENT', unassigned: true }]} />)
    fireEvent.change(screen.getByLabelText('Apply saved workflow view'), { target: { value: 'view-1' } })
    expect(router.replace).toHaveBeenLastCalledWith('/firms/hearth/workflow/flow-1?due=overdue&priority=URGENT&unassigned=true')
  })
})
