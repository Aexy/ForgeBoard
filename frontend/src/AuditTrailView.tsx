import { FormEvent, useEffect, useRef, useState } from 'react'
import { Activity, AuditTrailFilters, listAuditTrail } from './api/activity'

const emptyFilters: AuditTrailFilters = {}

export function AuditTrailView({ firmId }: { firmId: string }) {
  const currentFirmId = useRef(firmId)
  const requestGeneration = useRef(0)
  currentFirmId.current = firmId
  const [filters, setFilters] = useState<AuditTrailFilters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<AuditTrailFilters>(emptyFilters)
  const [items, setItems] = useState<Activity[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const generation = ++requestGeneration.current
    setItems([]); setNextCursor(null); setError(''); setLoading(true)
    listAuditTrail(firmId, appliedFilters)
      .then((page) => { if (!cancelled && currentFirmId.current === firmId && requestGeneration.current === generation) { setItems(page.items); setNextCursor(page.nextCursor) } })
      .catch(() => { if (!cancelled && currentFirmId.current === firmId && requestGeneration.current === generation) setError('The audit trail could not be loaded.') })
      .finally(() => { if (!cancelled && currentFirmId.current === firmId && requestGeneration.current === generation) setLoading(false) })
    return () => { cancelled = true }
  }, [firmId, appliedFilters])

  function apply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setAppliedFilters({ ...filters }) }
  function reset() { setFilters(emptyFilters); setAppliedFilters(emptyFilters) }
  async function loadMore() {
    if (!nextCursor || loadingMore) return
    const generation = requestGeneration.current
    setLoadingMore(true); setError('')
    try {
      const page = await listAuditTrail(firmId, appliedFilters, nextCursor)
      if (currentFirmId.current === firmId && requestGeneration.current === generation) { setItems((current) => [...current, ...page.items]); setNextCursor(page.nextCursor) }
    } catch { if (currentFirmId.current === firmId && requestGeneration.current === generation) setError('More audit activity could not be loaded.') }
    finally { if (currentFirmId.current === firmId && requestGeneration.current === generation) setLoadingMore(false) }
  }

  return <section className="workspace audit-trail">
    <header><div><p className="eyebrow">Firm oversight</p><h1>Audit trail</h1><p>Review every recorded change across this firm.</p></div></header>
    <form className="audit-filters" onSubmit={apply}>
      <label>Action<select value={filters.action ?? ''} onChange={(event) => setFilters({ ...filters, action: event.target.value || undefined })}><option value="">All actions</option><option value="firm.created">Firm created</option><option value="client.created">Client created</option><option value="client.updated">Client updated</option><option value="client.archived">Client archived</option><option value="client.imported">Clients imported</option><option value="employee.created">Employee created</option><option value="workflow.created">Workflow created</option><option value="work-item.created">Work item created</option><option value="work-item.moved">Work item moved</option><option value="work-item.assigned">Work item assigned</option><option value="work-item.unassigned">Work item unassigned</option><option value="engagement-template.created">Engagement template created</option><option value="engagement.created">Engagement created</option><option value="document-request.created">Document request created</option><option value="document-request.received">Document request received</option></select></label>
      <label>Actor<select value={filters.actorType ?? ''} onChange={(event) => setFilters({ ...filters, actorType: (event.target.value || undefined) as AuditTrailFilters['actorType'] })}><option value="">All actors</option><option value="USER">User</option><option value="SERVICE">Service</option><option value="SYSTEM">System</option></select></label>
      <label>Source<select value={filters.source ?? ''} onChange={(event) => setFilters({ ...filters, source: (event.target.value || undefined) as AuditTrailFilters['source'] })}><option value="">All sources</option><option value="WEB">Web</option><option value="REST">REST</option><option value="MCP">MCP</option><option value="JOB">Job</option></select></label>
      <label>From<input type="date" value={filters.from ?? ''} onChange={(event) => setFilters({ ...filters, from: event.target.value || undefined })}/></label>
      <label>To<input type="date" value={filters.to ?? ''} onChange={(event) => setFilters({ ...filters, to: event.target.value || undefined })}/></label>
      <div className="audit-filter-actions"><button className="primary-action">Apply filters</button><button className="secondary" type="button" onClick={reset}>Reset</button></div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="empty-state">Loading audit activity…</p> : items.length === 0 ? <div className="empty-state"><h2>No activity found</h2><p>Try changing the selected filters or return later.</p></div> : <ol className="audit-list">{items.map((item, index) => <li key={`${item.occurredAt}-${item.targetId}-${index}`}><strong>{label(item.action)}</strong><span>{summary(item)}</span><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time><small>{item.actorType.toLowerCase()} via {item.source.toLowerCase()}</small></li>)}</ol>}
    {nextCursor && <button className="secondary audit-load-more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
  </section>
}

function label(action: string) { return action.replaceAll('.', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function summary(activity: Activity) { const title = activity.summary.title; const name = activity.summary.displayName ?? activity.summary.name; return typeof title === 'string' ? title : typeof name === 'string' ? name : 'ForgeBoard activity' }
