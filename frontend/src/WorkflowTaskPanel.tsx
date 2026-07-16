import { WorkItemDetail } from './api/workflows'

export function WorkflowTaskPanel({ detail, onClose, mobile = false }: { detail: WorkItemDetail; onClose: () => void; mobile?: boolean }) {
  return <aside className={`task-panel${mobile ? ' task-sheet' : ''}`} role={mobile ? 'dialog' : undefined} aria-modal={mobile || undefined} aria-label={`${detail.item.title} details`}>
    <div className="task-panel-heading"><div><p className="eyebrow">Work item</p><h2>{detail.item.title}</h2></div><button type="button" className="secondary" onClick={onClose}>Close</button></div>
    <p className="task-client">{detail.clientDisplayName}</p>
    {detail.item.description && <p>{detail.item.description}</p>}
    <dl className="task-metadata"><div><dt>Owner</dt><dd>{detail.item.ownerDisplayName ?? 'Unassigned'}</dd></div><div><dt>Reviewer</dt><dd>{detail.item.reviewerDisplayName ?? 'Unassigned'}</dd></div><div><dt>Due date</dt><dd>{detail.item.dueDate ?? 'No due date'}</dd></div><div><dt>Priority</dt><dd>{detail.item.priority}</dd></div></dl>
    <TaskDocuments detail={detail}/>
  </aside>
}

export function TaskDocuments({ detail }: { detail: WorkItemDetail }) {
  return <section className="task-documents" aria-labelledby="linked-requests"><h3 id="linked-requests">Linked document requests</h3>{detail.documentRequests.length === 0 ? <p>No document requests linked.</p> : <ul>{detail.documentRequests.map((request) => <li key={request.id}><strong>{request.label}</strong><span>{request.status.toLowerCase().replace('_', ' ')}</span></li>)}</ul>}</section>
}
