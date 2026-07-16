import { useQuery } from '@tanstack/react-query'
import { EmployeeWorkItem, employeeDashboardKey, getMyWorkDashboard } from './api/employeeDashboard'

function Group({ title, items }: { title: string; items: EmployeeWorkItem[] }) {
  return <section className="column"><div className="column-title"><h2>{title}</h2><span>{items.length}</span></div>{items.length === 0 ? <p>No work items.</p> : items.map((item) => <article className="work-card" key={item.id}><h3>{item.title}</h3><p>{item.stageName}{item.dueDate ? ` - Due ${item.dueDate}` : ''}</p></article>)}</section>
}

export function MyWorkDashboard({ firmId }: { firmId: string }) {
  const dashboard = useQuery({ queryKey: employeeDashboardKey(firmId), queryFn: () => getMyWorkDashboard(firmId) })

  return <section className="workspace"><header><div><p className="eyebrow">Personal work queue</p><h1>My work</h1><p>Only work assigned to you in this firm is shown here.</p></div></header>{dashboard.isError ? <p className="form-error" role="alert">Your assigned work could not be loaded.</p> : dashboard.isPending || !dashboard.data ? <p className="empty-state" aria-live="polite">Loading your work...</p> : <div className="board" aria-label="My assigned work"><Group title="Overdue" items={dashboard.data.overdue} /><Group title="Due soon" items={dashboard.data.dueSoon} /><Group title="Blocked" items={dashboard.data.blocked} /><Group title="Awaiting review" items={dashboard.data.awaitingReview} /><Group title="Active" items={dashboard.data.active} /></div>}</section>
}
