'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useWorkflowLanguage } from './useWorkflowLanguage'
import type { WorkflowFilterView } from '@/store/api'
import styles from './WorkflowBoard.module.css'

export interface BoardFilters { client: string; owner: string; due: string; priority: string; unassigned: boolean }

export function filtersFromSearch(search: Pick<URLSearchParams, 'get'>): BoardFilters {
  return { client: search.get('client') ?? '', owner: search.get('owner') ?? '', due: search.get('due') ?? '', priority: search.get('priority') ?? '', unassigned: search.get('unassigned') === 'true' }
}

function dueFilter(value: WorkflowFilterView['dueState']) { return value === 'OVERDUE' ? 'overdue' : value === 'DUE_TODAY' ? 'today' : value === 'DUE_SOON' ? 'soon' : value === 'NO_DUE_DATE' ? 'none' : '' }

export function WorkflowFilters({ basePath, savedViews = [] }: Readonly<{ basePath: string; savedViews?: WorkflowFilterView[] }>) {
  const router = useRouter()
  const search = useSearchParams()
  const t = useWorkflowLanguage()
  const filters = filtersFromSearch(search)
  const replace = (next: Partial<BoardFilters>) => {
    const query = new URLSearchParams(search.toString())
    const values = { ...filters, ...next }
    ;(['client', 'owner', 'due', 'priority'] as const).forEach((key) => values[key] ? query.set(key, values[key]) : query.delete(key))
    values.unassigned ? query.set('unassigned', 'true') : query.delete('unassigned')
    query.delete('task')
    router.replace(`${basePath}${query.size ? `?${query}` : ''}`)
  }
  const applyView = (viewId: string) => { const view = savedViews.find((candidate) => candidate.id === viewId); if (view) replace({ client: view.clientId ?? '', owner: view.ownerUserId ?? '', due: dueFilter(view.dueState), priority: view.priority ?? '', unassigned: Boolean(view.unassigned) }) }
  return <details className={styles.workflowFilters}>
    <summary>{t('Filters')}</summary>
    <div>
      <label>{t('Client')}<input aria-label={t('Client')} value={filters.client} onChange={(event) => replace({ client: event.target.value })} /></label>
      <label>{t('Owner')}<input aria-label={t('Owner')} value={filters.owner} onChange={(event) => replace({ owner: event.target.value })} /></label>
      <label>{t('Due state')}<select aria-label={t('Due state')} value={filters.due} onChange={(event) => replace({ due: event.target.value })}><option value="">{t('All due states')}</option><option value="overdue">{t('Overdue')}</option><option value="today">{t('Due today')}</option><option value="soon">{t('Due soon')}</option><option value="none">{t('No due date')}</option></select></label>
      <label>{t('Priority')}<select aria-label={t('Priority')} value={filters.priority} onChange={(event) => replace({ priority: event.target.value })}><option value="">{t('All priorities')}</option>{['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label><input aria-label={t('Unassigned')} type="checkbox" checked={filters.unassigned} onChange={(event) => replace({ unassigned: event.target.checked })} />{t('Unassigned')}</label>
      {savedViews.length > 0 && <label>Saved view<select aria-label="Apply saved workflow view" defaultValue="" onChange={(event) => applyView(event.target.value)}><option value="">Apply saved view</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>}
      <button type="button" onClick={() => replace({ client: '', owner: '', due: '', priority: '', unassigned: false })}>{t('Reset filters')}</button>
    </div>
  </details>
}
