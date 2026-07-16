import { Employee } from './api/employees'
import { WorkItemDetail } from './api/workflows'
import { TaskDocuments } from './WorkflowTaskPanel'

export function WorkflowTaskWorkspace({ detail, employees, canManage, onBack, onReviewerChange, error }: { detail: WorkItemDetail; employees: Employee[]; canManage: boolean; onBack: () => void; onReviewerChange: (userId: string) => void; error: string; }) {
  const selfReview = Boolean(detail.item.ownerUserId && detail.item.ownerUserId === detail.item.reviewerUserId)
  return <section className="workspace task-workspace" aria-labelledby="task-workspace-title"><header><div><p className="eyebrow">Task workspace</p><h1 id="task-workspace-title">{detail.item.title}</h1><p>{detail.clientDisplayName}</p></div><button type="button" className="secondary" onClick={onBack}>Back to workflow</button></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="task-workspace-grid"><article><h2>Task details</h2><p>{detail.item.description || 'No description provided.'}</p><dl className="task-metadata"><div><dt>Owner</dt><dd>{detail.item.ownerDisplayName ?? 'Unassigned'}</dd></div><div><dt>Due date</dt><dd>{detail.item.dueDate ?? 'No due date'}</dd></div><div><dt>Priority</dt><dd>{detail.item.priority}</dd></div></dl></article>
      <article><h2>Review</h2>{canManage ? <label>Reviewer<select aria-label="Select reviewer" value={detail.item.reviewerUserId ?? ''} onChange={(e) => onReviewerChange(e.target.value)}><option value="">Unassigned</option>{employees.map((employee) => <option key={employee.userId} value={employee.userId}>{employee.displayName}</option>)}</select></label> : <p>{detail.item.reviewerDisplayName ?? 'No reviewer assigned.'}</p>}{selfReview && <p className="review-warning" role="status">The owner is also the reviewer. This is allowed, but a separate reviewer is recommended.</p>}</article>
      <article><TaskDocuments detail={detail}/></article>
      <article><h2>Recent activity</h2>{detail.activity.length ? <ol className="task-activity">{detail.activity.map((event, index) => <li key={`${event.occurredAt}-${index}`}>{event.action.replaceAll('.', ' ')}<time>{new Date(event.occurredAt).toLocaleString()}</time></li>)}</ol> : <p>No activity recorded for this work item.</p>}</article>
    </div>
  </section>
}
