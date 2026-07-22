'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/app/LanguageProvider'
import type { WorkflowFilterView, WorkflowSummary } from './workflow-transport'
import styles from './WorkflowBoard.module.css'
import { boardPathWithoutTask, filteredBoardPath, filtersFromSearch, type BoardFilters } from './workflow-route-state'

export { filtersFromSearch, type BoardFilters } from './workflow-route-state'

function dueFilter(value: WorkflowFilterView['dueState']) { return value === 'OVERDUE' ? 'overdue' : value === 'DUE_TODAY' ? 'today' : value === 'DUE_SOON' ? 'soon' : value === 'NO_DUE_DATE' ? 'none' : '' }

export function WorkflowFilters({ basePath, savedViews = [], workflows = [] }: Readonly<{ basePath: string; savedViews?: WorkflowFilterView[]; workflows?: WorkflowSummary[] }>) {
  const router = useRouter()
  const search = useSearchParams()
  const { t } = useLanguage()
  const filters = filtersFromSearch(search)
  const replace = (next: Partial<BoardFilters>) => {
    router.replace(filteredBoardPath(basePath, search, next))
  }
  const switchWorkflow = (workflowSlug: string) => {
    const workflowBasePath = `${basePath.slice(0, basePath.lastIndexOf('/') + 1)}${workflowSlug}`
    router.push(boardPathWithoutTask(workflowBasePath, search))
  }
  const applyView = (viewId: string) => { const view = savedViews.find((candidate) => candidate.id === viewId); if (view) replace({ client: view.clientId ?? '', owner: view.ownerUserId ?? '', due: dueFilter(view.dueState), priority: view.priority ?? '', unassigned: Boolean(view.unassigned) }) }
  return <details className={styles.workflowFilters}>
    <summary>{t('workflow.filters')}</summary>
    <div>
      {workflows.length > 1 && <label>{t('navigation.workflow')}<select aria-label={t('navigation.workflow')} value={basePath.slice(basePath.lastIndexOf('/') + 1)} onChange={(event) => switchWorkflow(event.target.value)}>{workflows.map((workflow) => <option key={workflow.id} value={workflow.workflowSlug}>{workflow.name}</option>)}</select></label>}
      <label>{t('common.client')}<input aria-label={t('common.client')} value={filters.client} onChange={(event) => replace({ client: event.target.value })} /></label>
      <label>{t('common.owner')}<input aria-label={t('common.owner')} value={filters.owner} onChange={(event) => replace({ owner: event.target.value })} /></label>
      <label>{t('workflow.dueState')}<select aria-label={t('workflow.dueState')} value={filters.due} onChange={(event) => replace({ due: event.target.value })}><option value="">{t('workflow.allDueStates')}</option><option value="overdue">{t('workflow.overdue')}</option><option value="today">{t('workflow.dueToday')}</option><option value="soon">{t('workflow.dueSoon')}</option><option value="none">{t('workflow.noDueDate')}</option></select></label>
      <label>{t('common.priority')}<select aria-label={t('common.priority')} value={filters.priority} onChange={(event) => replace({ priority: event.target.value })}><option value="">{t('workflow.allPriorities')}</option>{['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
      <label><input aria-label={t('common.unassigned')} type="checkbox" checked={filters.unassigned} onChange={(event) => replace({ unassigned: event.target.checked })} />{t('common.unassigned')}</label>
      {savedViews.length > 0 && <label>{t('workflow.savedView')}<select aria-label={t('workflow.applySavedView')} defaultValue="" onChange={(event) => applyView(event.target.value)}><option value="">{t('workflow.applySavedView')}</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>}
      <button type="button" onClick={() => replace({ client: '', owner: '', due: '', priority: '', unassigned: false })}>{t('workflow.resetFilters')}</button>
    </div>
  </details>
}
