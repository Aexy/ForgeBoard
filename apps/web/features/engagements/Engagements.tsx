'use client'

import { type FormEvent, useMemo, useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'
import {
  type Client,
  type DocumentRequest,
  type Engagement,
  type EngagementTemplate,
  type Recurrence,
  useCreateDocumentRequestMutation,
  useCreateEngagementMutation,
  useCreateEngagementTemplateMutation,
  useGetClientsQuery,
  useGetDocumentRequestsQuery,
  useGetEngagementsQuery,
  useGetEngagementTemplatesQuery,
  useGetWorkflowsQuery,
  useReceiveDocumentRequestMutation,
} from '@/store/api'

import styles from './Engagements.module.css'

const today = () => new Date().toISOString().slice(0, 10)
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : 'No deadline'
const recurrenceOptions: Recurrence[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

export function Engagements() {
  const firm = useFirmContext()
  const canWrite = firm.role !== 'READ_ONLY'
  const clients = useGetClientsQuery({ firm })
  const workflows = useGetWorkflowsQuery({ firm })
  const templates = useGetEngagementTemplatesQuery({ firm })
  const engagements = useGetEngagementsQuery({ firm })
  const requests = useGetDocumentRequestsQuery({ firm })
  const [createTemplate, templateResult] = useCreateEngagementTemplateMutation()
  const [createEngagement, engagementResult] = useCreateEngagementMutation()
  const [createRequest, requestResult] = useCreateDocumentRequestMutation()
  const [receiveRequest] = useReceiveDocumentRequestMutation()
  const [templateForm, setTemplateForm] = useState(false)
  const [engagementForm, setEngagementForm] = useState(false)
  const [requestForm, setRequestForm] = useState(false)
  const [error, setError] = useState('')

  const activeClients = useMemo(() => (clients.data ?? []).filter((client) => client.status === 'ACTIVE'), [clients.data])
  const clientNames = useMemo(() => new Map((clients.data ?? []).map((client) => [client.id, client.displayName])), [clients.data])
  const templateNames = useMemo(() => new Map((templates.data ?? []).map((template) => [template.id, template.name])), [templates.data])
  const loading = clients.isLoading || workflows.isLoading || templates.isLoading || engagements.isLoading || requests.isLoading
  const loadError = clients.isError || workflows.isError || templates.isError || engagements.isError || requests.isError

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createTemplate({ firm, template: { name: String(data.get('name')), workflowId: String(data.get('workflowId')), recurrence: String(data.get('recurrence')) as Recurrence, defaultWorkItemTitle: String(data.get('defaultWorkItemTitle')), dueDay: Number(data.get('dueDay')) } }).unwrap()
      form.reset(); setTemplateForm(false)
    } catch { setError('The engagement template could not be created.') }
  }

  async function submitEngagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createEngagement({ firm, templateId: String(data.get('templateId')), details: { clientId: String(data.get('clientId')), periodStart: String(data.get('periodStart')) } }).unwrap()
      form.reset(); setEngagementForm(false)
    } catch { setError('The engagement could not be started. It may already exist for that client and period.') }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createRequest({ firm, request: { clientId: String(data.get('clientId')), label: String(data.get('label')), externalReference: String(data.get('externalReference')) || null, dueDate: String(data.get('dueDate')) || null } }).unwrap()
      form.reset(); setRequestForm(false)
    } catch { setError('The document request could not be created.') }
  }

  async function receive(request: DocumentRequest) {
    setError('')
    try { await receiveRequest({ firm, requestId: request.id }).unwrap() } catch { setError('The document request could not be marked received.') }
  }

  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>Recurring client work</p><h1>Engagements</h1><p>Launch repeatable client cycles and keep every prerequisite visible.</p></div>{canWrite && <div className={styles.actions}><button type="button" onClick={() => setTemplateForm((open) => !open)} disabled={workflows.data?.length === 0}>{templateForm ? 'Cancel' : '+ New template'}</button><button type="button" onClick={() => setEngagementForm((open) => !open)} disabled={templates.data?.length === 0 || activeClients.length === 0}>{engagementForm ? 'Cancel' : '+ Start engagement'}</button></div>}</header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loadError && <p className={styles.error} role="alert">Some engagement data could not be loaded. Please refresh and try again.</p>}
    {!loading && (activeClients.length === 0 || workflows.data?.length === 0) && <div className={styles.notice}><strong>Before you start</strong><span>Create at least one active client and workflow before creating an engagement template.</span></div>}
    {canWrite && templateForm && <form className={styles.form} onSubmit={submitTemplate}><h2>New engagement template</h2><label>Name<input name="name" required maxLength={160} placeholder="Monthly bookkeeping" /></label><label>Workflow<select name="workflowId" required defaultValue=""><option value="" disabled>Select a workflow</option>{workflows.data?.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select></label><label>Recurrence<select name="recurrence" defaultValue="MONTHLY">{recurrenceOptions.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label><label>Default work item<input name="defaultWorkItemTitle" required maxLength={200} placeholder="Prepare bookkeeping for {{period}}" /></label><label>Due day<input name="dueDay" type="number" min="1" max="31" defaultValue="20" required /></label><button disabled={templateResult.isLoading}>Save template</button></form>}
    {canWrite && engagementForm && <form className={styles.form} onSubmit={submitEngagement}><h2>Start an engagement</h2><label>Template<select name="templateId" required defaultValue=""><option value="" disabled>Select a template</option>{templates.data?.map((template: EngagementTemplate) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select a client</option>{activeClients.map((client: Client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label><label>Period start<input name="periodStart" type="date" defaultValue={today()} required /></label><button disabled={engagementResult.isLoading}>Start engagement</button></form>}
    <div className={styles.grid}><section className={styles.section}><div><h2>Active engagements</h2><p>{engagements.data?.length ?? 0} scheduled client cycles</p></div>{loading ? <p aria-live="polite">Loading engagements…</p> : engagements.data?.length === 0 ? <div className={styles.empty}><h3>No engagements yet</h3><p>Create a template, then start the first client cycle.</p></div> : <div className={styles.list}>{engagements.data?.map((engagement: Engagement) => <article className={styles.row} key={engagement.id}><div><span>{engagement.status.toLowerCase()}</span><h3>{templateNames.get(engagement.templateId) ?? 'Engagement'}</h3><p>{clientNames.get(engagement.clientId) ?? 'Unknown client'} · {displayDate(engagement.periodStart)} to {displayDate(engagement.periodEnd)}</p>{engagement.workItemId && <p>Board work item created</p>}</div><time dateTime={engagement.dueDate}>Due {displayDate(engagement.dueDate)}</time></article>)}</div>}</section>
      <section className={styles.section}><div className={styles.sectionHeading}><div><h2>Document requests</h2><p>Metadata only — no documents stored here.</p></div>{canWrite && <button type="button" onClick={() => setRequestForm((open) => !open)} disabled={activeClients.length === 0}>{requestForm ? 'Cancel' : '+ Request'}</button>}</div>{canWrite && requestForm && <form className={styles.form} onSubmit={submitRequest}><label>Client<select name="clientId" required defaultValue=""><option value="" disabled>Select a client</option>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label><label>Request<input name="label" required maxLength={200} /></label><label>Secure reference<input name="externalReference" maxLength={1000} /></label><label>Due date<input name="dueDate" type="date" /></label><button disabled={requestResult.isLoading}>Send request</button></form>}{loading ? <p aria-live="polite">Loading requests…</p> : requests.data?.length === 0 ? <div className={styles.empty}><h3>No document requests</h3><p>Track what you need without storing the source document.</p></div> : <div className={styles.list}>{requests.data?.map((request: DocumentRequest) => <article className={styles.row} key={request.id}><div><span>{request.status.toLowerCase()}</span><h3>{request.label}</h3><p>{clientNames.get(request.clientId) ?? 'Unknown client'} · {displayDate(request.dueDate)}</p>{request.externalReference && <p>Reference: {request.externalReference}</p>}</div>{canWrite && request.status === 'REQUESTED' && <button type="button" onClick={() => receive(request)}>Mark received</button>}</article>)}</div>}</section></div>
  </section>
}
