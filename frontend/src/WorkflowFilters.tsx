import { Client } from './api/clients'
import { Employee } from './api/employees'
import { WorkPriority } from './api/workflows'

export type BoardFilters = { client: string; owner: string; due: string; priority: string; unassigned: boolean }
export function WorkflowFilters({ clients, employees, filters, onChange, onReset }: { clients: Client[]; employees: Employee[]; filters: BoardFilters; onChange: (filters: BoardFilters) => void; onReset: () => void }) {
  return <div className="workflow-filters" aria-label="Workflow filters">
    <label>Client<select aria-label="Filter by client" value={filters.client} onChange={(e) => onChange({ ...filters, client: e.target.value })}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
    <label>Owner<select aria-label="Filter by owner" value={filters.owner} onChange={(e) => onChange({ ...filters, owner: e.target.value })}><option value="">All owners</option>{employees.map((e) => <option key={e.userId} value={e.userId}>{e.displayName}</option>)}</select></label>
    <label>Due state<select aria-label="Filter by due state" value={filters.due} onChange={(e) => onChange({ ...filters, due: e.target.value })}><option value="">All due states</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="soon">Due soon</option><option value="none">No due date</option></select></label>
    <label>Priority<select aria-label="Filter by priority" value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value })}><option value="">All priorities</option>{(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as WorkPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
    <label className="filter-check"><input aria-label="Show unassigned work" type="checkbox" checked={filters.unassigned} onChange={(e) => onChange({ ...filters, unassigned: e.target.checked })}/>Unassigned</label>
    <button type="button" className="secondary" onClick={onReset}>Reset filters</button>
  </div>
}
