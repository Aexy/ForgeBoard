import { useState } from 'react'
import { Client } from './api/clients'
import { Employee } from './api/employees'
import { WorkPriority } from './api/workflows'

export type BoardFilters = { client: string; owner: string; due: string; priority: string; unassigned: boolean }
export function WorkflowFilters({ clients, employees, filters, onChange, onReset, savedViews, selectedSavedViewId, canManageViews, onApplyView, onSaveView, onDeleteView }: { clients: Client[]; employees: Employee[]; filters: BoardFilters; onChange: (filters: BoardFilters) => void; onReset: () => void; savedViews?: Array<{ id: string; name: string }>; selectedSavedViewId?: string; canManageViews?: boolean; onApplyView?: (id: string) => void; onSaveView?: (name: string) => void; onDeleteView?: (id: string) => void }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  return <div className="workflow-filter-disclosure">
    <button type="button" className="secondary workflow-filter-toggle" aria-expanded={filtersOpen} aria-controls="workflow-filter-controls" onClick={() => setFiltersOpen((open) => !open)}>Filters</button>
    <div id="workflow-filter-controls" className="workflow-filters" aria-label="Workflow filters" hidden={!filtersOpen}>
    <label>Client<select aria-label="Filter by client" value={filters.client} onChange={(e) => onChange({ ...filters, client: e.target.value })}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
    <label>Owner<select aria-label="Filter by owner" value={filters.owner} onChange={(e) => onChange({ ...filters, owner: e.target.value })}><option value="">All owners</option>{employees.map((e) => <option key={e.userId} value={e.userId}>{e.displayName}</option>)}</select></label>
    <label>Due state<select aria-label="Filter by due state" value={filters.due} onChange={(e) => onChange({ ...filters, due: e.target.value })}><option value="">All due states</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="soon">Due soon</option><option value="none">No due date</option></select></label>
    <label>Priority<select aria-label="Filter by priority" value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value })}><option value="">All priorities</option>{(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as WorkPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
    <label className="filter-check"><input aria-label="Show unassigned work" type="checkbox" checked={filters.unassigned} onChange={(e) => onChange({ ...filters, unassigned: e.target.checked })}/>Unassigned</label>
    <button type="button" className="secondary" onClick={onReset}>Reset filters</button>
    {savedViews && savedViews.length > 0 && <label>Saved view<select aria-label="Apply saved workflow view" value={selectedSavedViewId ?? ''} onChange={(event) => { if (event.target.value) onApplyView?.(event.target.value) }}><option value="">Apply saved view</option>{savedViews.map((view) => <option value={view.id} key={view.id}>{view.name}</option>)}</select></label>}
    {canManageViews && <SaveView onSave={onSaveView!}/>}
    {canManageViews && savedViews && savedViews.length > 0 && <label>Manage saved view<select aria-label="Delete saved workflow view" defaultValue="" onChange={(event) => { if (event.target.value) onDeleteView?.(event.target.value); event.currentTarget.value = '' }}><option value="">Delete saved view</option>{savedViews.map((view) => <option value={view.id} key={view.id}>{view.name}</option>)}</select></label>}
    </div>
  </div>
}

function SaveView({ onSave }: { onSave: (name: string) => void }) {
  return <form className="save-view-form" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('viewName') as HTMLInputElement; const name = input.value.trim(); if (name) { onSave(name); input.value = '' } }}><label>Save shared view<input name="viewName" aria-label="Shared view name" maxLength={80} required/></label><button type="submit" className="secondary">Save view</button></form>
}
