import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Client, listClients } from './api/clients'
import { createDocumentRequest, DocumentRequest, listDocumentRequests, markDocumentRequestReceived } from './api/documentRequests'
import { createEngagementInstance, createEngagementTemplate, Engagement, EngagementApiError, EngagementTemplate, listEngagements, listEngagementTemplates, Recurrence } from './api/engagements'
import { listWorkflows, WorkflowSummary } from './api/workflows'

const today = () => new Date().toISOString().slice(0, 10)
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'No deadline'

function messageFor(error: unknown, fallback: string) {
  return error instanceof EngagementApiError ? error.message : fallback
}

export function EngagementsView({ firmId }: { firmId: string }) {
  const [clients, setClients] = useState<Client[]>([])
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [templates, setTemplates] = useState<EngagementTemplate[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [requests, setRequests] = useState<DocumentRequest[]>([])
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [templateForm, setTemplateForm] = useState(false)
  const [engagementForm, setEngagementForm] = useState(false)
  const [requestForm, setRequestForm] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    Promise.allSettled([
      listClients(firmId),
      listWorkflows(firmId),
      listEngagementTemplates(firmId),
      listEngagements(firmId),
      listDocumentRequests(firmId),
    ]).then(([clientResult, workflowResult, templateResult, engagementResult, requestResult]) => {
      if (!active) return
      const unavailable: string[] = []
      if (clientResult.status === 'fulfilled') setClients(clientResult.value.filter((client) => client.status === 'ACTIVE'))
      else unavailable.push('clients')
      if (workflowResult.status === 'fulfilled') setWorkflows(workflowResult.value)
      else unavailable.push('workflows')
      if (templateResult.status === 'fulfilled') setTemplates(templateResult.value)
      else unavailable.push('templates')
      if (engagementResult.status === 'fulfilled') setEngagements(engagementResult.value)
      else unavailable.push('engagements')
      if (requestResult.status === 'fulfilled') setRequests(requestResult.value)
      else unavailable.push('document requests')
      if (unavailable.length > 0) setLoadError(`Some data could not be loaded: ${unavailable.join(', ')}. You can still use the available sections.`)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [firmId])

  const clientName = useMemo(() => new Map(clients.map((client) => [client.id, client.displayName])), [clients])
  const templateName = useMemo(() => new Map(templates.map((template) => [template.id, template.name])), [templates])
  const hasSetupData = clients.length > 0 && workflows.length > 0

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setActionError('')
    setSavingTemplate(true)
    try {
      const created = await createEngagementTemplate(firmId, {
        name: String(data.get('name')),
        workflowId: String(data.get('workflowId')),
        recurrence: String(data.get('recurrence')) as Recurrence,
        defaultWorkItemTitle: String(data.get('defaultWorkItemTitle')),
        dueDay: Number(data.get('dueDay')),
      })
      setTemplates((all) => [...all, created].sort((left, right) => left.name.localeCompare(right.name)))
      setTemplateForm(false)
      form.reset()
    } catch (error) {
      setActionError(messageFor(error, 'The engagement template could not be created.'))
    } finally {
      setSavingTemplate(false)
    }
  }

  async function submitEngagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setActionError('')
    try {
      const created = await createEngagementInstance(firmId, String(data.get('templateId')), {
        clientId: String(data.get('clientId')),
        periodStart: String(data.get('periodStart')),
      })
      setEngagements((all) => [...all, created].sort((left, right) => left.dueDate.localeCompare(right.dueDate)))
      setEngagementForm(false)
      form.reset()
    } catch (error) {
      setActionError(messageFor(error, 'The engagement could not be created.'))
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setActionError('')
    try {
      const created = await createDocumentRequest(firmId, {
        clientId: String(data.get('clientId')),
        label: String(data.get('label')),
        externalReference: String(data.get('externalReference')),
        dueDate: String(data.get('dueDate')) || null,
      })
      setRequests((all) => [...all, created])
      setRequestForm(false)
      form.reset()
    } catch {
      setActionError('The document request could not be created.')
    }
  }

  async function receive(request: DocumentRequest) {
    setActionError('')
    try {
      const received = await markDocumentRequestReceived(firmId, request.id)
      setRequests((all) => all.map((item) => item.id === received.id ? received : item))
    } catch {
      setActionError('The document request could not be marked received.')
    }
  }

  return <section className="workspace engagements-view">
    <header>
      <div><p className="eyebrow">Recurring client work</p><h1>Engagements</h1><p>Launch repeatable client cycles and keep every prerequisite visible.</p></div>
      <div className="header-actions">
        <button type="button" className="secondary" onClick={() => setTemplateForm(!templateForm)} disabled={loading || workflows.length === 0}>{templateForm ? 'Cancel' : '+ New template'}</button>
        <button type="button" onClick={() => setEngagementForm(!engagementForm)} disabled={templates.length === 0 || clients.length === 0}>{engagementForm ? 'Cancel' : '+ Start engagement'}</button>
      </div>
    </header>
    {loadError && <p className="form-error" role="status">{loadError}</p>}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    {!hasSetupData && !loading && <div className="setup-note"><strong>Before you start</strong><span>Create at least one active client and one workflow, then create a recurring engagement template.</span></div>}
    {templateForm && <form className="engagement-form" onSubmit={submitTemplate}>
      <h2>New engagement template</h2>
      <label>Name<input name="name" required maxLength={160} placeholder="Monthly bookkeeping" /></label>
      <label>Workflow<select name="workflowId" required defaultValue=""><option value="" disabled>Select a workflow</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select></label>
      <label>Recurrence<select name="recurrence" defaultValue="MONTHLY"><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="ANNUAL">Annual</option></select></label>
      <label>Default work item<input name="defaultWorkItemTitle" required maxLength={200} placeholder="Prepare bookkeeping for {{period}}" /></label>
      <label>Due day<input name="dueDay" type="number" min="1" max="31" defaultValue="20" required /></label>
      <button className="primary-action" disabled={savingTemplate}>{savingTemplate ? 'Saving template…' : 'Save template'}</button>
    </form>}
    {engagementForm && <form className="engagement-form" onSubmit={submitEngagement}>
      <h2>Start an engagement</h2>
      <label>Template<select name="templateId" required defaultValue=""><option value="" disabled>Select a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      <label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label>
      <label>Period start<input name="periodStart" type="date" defaultValue={today()} required /></label>
      <button className="primary-action">Start engagement</button>
    </form>}
    <div className="engagement-grid">
      <section className="engagement-section"><div className="section-heading"><div><h2>Active engagements</h2><p>{engagements.length} scheduled client cycle{engagements.length === 1 ? '' : 's'}</p></div></div>{loading ? <p className="empty-state">Loading engagements...</p> : engagements.length === 0 ? <div className="empty-state"><h3>No engagements yet</h3><p>Create a template, then start the first client cycle.</p></div> : <div className="engagement-list">{engagements.map((engagement) => <article key={engagement.id} className="engagement-row"><div><span className="status">{engagement.status.toLowerCase()}</span><h3>{templateName.get(engagement.templateId) ?? 'Engagement'}</h3><p>{clientName.get(engagement.clientId) ?? 'Unknown client'} · {displayDate(engagement.periodStart)} to {displayDate(engagement.periodEnd)}</p>{engagement.workItemId && <p className="reference">Board work item created</p>}</div><time dateTime={engagement.dueDate}>Due {displayDate(engagement.dueDate)}</time></article>)}</div>}</section>
      <section className="engagement-section document-section"><div className="section-heading"><div><h2>Document requests</h2><p>Metadata only — no documents stored here.</p></div><button type="button" className="secondary" onClick={() => setRequestForm(!requestForm)} disabled={clients.length === 0}>{requestForm ? 'Cancel' : '+ Request'}</button></div>{requestForm && <form className="request-form" onSubmit={submitRequest}><label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label><label>Request<input id="document-label" name="label" required maxLength={200} placeholder="Bank statement, May 2026" /></label><label>Secure reference<input name="externalReference" maxLength={1000} placeholder="Portal link or reference" /></label><label>Due date<input name="dueDate" type="date" /></label><button className="primary-action">Send request</button></form>}{loading ? <p className="empty-state">Loading requests...</p> : requests.length === 0 ? <div className="empty-state"><h3>No document requests</h3><p>Track what you need without storing the source document.</p></div> : <div className="request-list">{requests.map((request) => <article key={request.id} className={`request-row ${request.status === 'RECEIVED' ? 'received' : ''}`}><div><span className="status">{request.status.toLowerCase()}</span><h3>{request.label}</h3><p>{clientName.get(request.clientId) ?? 'Unknown client'} · {displayDate(request.dueDate)}</p>{request.externalReference && <p className="reference">Reference: {request.externalReference}</p>}</div>{request.status === 'REQUESTED' && <button type="button" className="secondary" onClick={() => receive(request)}>Mark received</button>}</article>)}</div>}</section>
    </div>
  </section>
}
