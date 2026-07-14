import { useEffect, useState } from 'react'
import { EmployeeDashboard, EmployeeWorkItem, getMyWorkDashboard } from './api/employeeDashboard'
function Group({ title, items }: { title: string; items: EmployeeWorkItem[] }) { return <section className="column"><div className="column-title"><h2>{title}</h2><span>{items.length}</span></div>{items.length === 0 ? <p>No work items.</p> : items.map((item) => <article className="work-card" key={item.id}><h3>{item.title}</h3><p>{item.stageName}{item.dueDate ? ` · Due ${item.dueDate}` : ''}</p></article>)}</section> }
export function MyWorkDashboard({ firmId }: { firmId: string }) {
  const [dashboard, setDashboard] = useState<EmployeeDashboard | null>(null); const [error, setError] = useState('')
  useEffect(() => { getMyWorkDashboard(firmId).then(setDashboard).catch(() => setError('Your assigned work could not be loaded.')) }, [firmId])
  return <section className="workspace"><header><div><p className="eyebrow">Personal work queue</p><h1>My work</h1><p>Only work assigned to you in this firm is shown here.</p></div></header>{error ? <p className="form-error" role="alert">{error}</p> : !dashboard ? <p className="empty-state" aria-live="polite">Loading your work…</p> : <div className="board" aria-label="My assigned work"><Group title="Overdue" items={dashboard.overdue} /><Group title="Due soon" items={dashboard.dueSoon} /><Group title="Blocked" items={dashboard.blocked} /><Group title="Awaiting review" items={dashboard.awaitingReview} /><Group title="Active" items={dashboard.active} /></div>}</section>
}
