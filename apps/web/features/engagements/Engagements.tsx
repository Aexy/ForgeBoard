'use client'

import { type FormEvent, useMemo, useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
import type { Client } from '@/features/clients/clients-transport'
import { useGetClientsQuery } from '@/features/clients/clients-transport'
import { useGetWorkflowsQuery } from '@/features/workflow/workflow-transport'
import {
  type DocumentRequest,
  type Engagement,
  type EngagementTemplate,
  type Recurrence,
  useCreateDocumentRequestMutation,
  useCreateEngagementMutation,
  useCreateEngagementTemplateMutation,
  useGetDocumentRequestsQuery,
  useGetEngagementsQuery,
  useGetEngagementTemplatesQuery,
  useReceiveDocumentRequestMutation,
} from './engagements-transport'

import styles from './Engagements.module.css'

const today = () => new Date().toISOString().slice(0, 10)
const displayDate = (value: string | null, noDeadline: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : noDeadline
const recurrenceOptions: Recurrence[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

export function Engagements() {
  const firm = useFirmContext()
  const { t } = useLanguage()
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
    } catch { setError(t('engagements.templateError')) }
  }

  async function submitEngagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createEngagement({ firm, templateId: String(data.get('templateId')), details: { clientId: String(data.get('clientId')), periodStart: String(data.get('periodStart')) } }).unwrap()
      form.reset(); setEngagementForm(false)
    } catch { setError(t('engagements.createError')) }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createRequest({ firm, request: { clientId: String(data.get('clientId')), label: String(data.get('label')), externalReference: String(data.get('externalReference')) || null, dueDate: String(data.get('dueDate')) || null } }).unwrap()
      form.reset(); setRequestForm(false)
    } catch { setError(t('engagements.requestError')) }
  }

  async function receive(request: DocumentRequest) {
    setError('')
    try { await receiveRequest({ firm, requestId: request.id }).unwrap() } catch { setError(t('engagements.receiveError')) }
  }

  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{t('engagements.eyebrow')}</p><h1>{t('engagements.title')}</h1><p>{t('engagements.description')}</p></div>{canWrite && <div className={styles.actions}><button type="button" onClick={() => setTemplateForm((open) => !open)} disabled={workflows.data?.length === 0}>{templateForm ? t('common.cancel') : t('engagements.newTemplate')}</button><button type="button" onClick={() => setEngagementForm((open) => !open)} disabled={templates.data?.length === 0 || activeClients.length === 0}>{engagementForm ? t('common.cancel') : t('engagements.startEngagement')}</button></div>}</header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loadError && <p className={styles.error} role="alert">{t('engagements.loadPartialError')}</p>}
    {!loading && (activeClients.length === 0 || workflows.data?.length === 0) && <div className={styles.notice}><strong>{t('engagements.beforeStart')}</strong><span>{t('engagements.beforeStartDescription')}</span></div>}
    {canWrite && templateForm && <form className={styles.form} onSubmit={submitTemplate}><h2>{t('engagements.newTemplateTitle')}</h2><label>{t('engagements.name')}<input name="name" required maxLength={160} placeholder="Monthly bookkeeping" /></label><label>{t('engagements.workflow')}<select name="workflowId" required defaultValue=""><option value="" disabled>{t('engagements.selectWorkflow')}</option>{workflows.data?.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select></label><label>{t('engagements.recurrence')}<select name="recurrence" defaultValue="MONTHLY">{recurrenceOptions.map((value) => <option key={value} value={value}>{t(`engagements.${value.toLowerCase()}` as 'engagements.monthly' | 'engagements.quarterly' | 'engagements.annual')}</option>)}</select></label><label>{t('engagements.defaultWorkItem')}<input name="defaultWorkItemTitle" required maxLength={200} placeholder="Prepare bookkeeping for {{period}}" /></label><label>{t('engagements.dueDay')}<input name="dueDay" type="number" min="1" max="31" defaultValue="20" required /></label><button disabled={templateResult.isLoading}>{t('engagements.saveTemplate')}</button></form>}
    {canWrite && engagementForm && <form className={styles.form} onSubmit={submitEngagement}><h2>{t('engagements.startTitle')}</h2><label>{t('engagements.template')}<select name="templateId" required defaultValue=""><option value="" disabled>{t('engagements.selectTemplate')}</option>{templates.data?.map((template: EngagementTemplate) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label>{t('common.client')}<select name="clientId" required defaultValue=""><option value="" disabled>{t('engagements.selectClient')}</option>{activeClients.map((client: Client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label><label>{t('engagements.periodStart')}<input name="periodStart" type="date" defaultValue={today()} required /></label><button disabled={engagementResult.isLoading}>{t('engagements.createEngagement')}</button></form>}
    <div className={styles.grid}><section className={styles.section}><div><h2>{t('engagements.active')}</h2><p>{engagements.data?.length ?? 0} {t('engagements.scheduledCycles')}</p></div>{loading ? <p aria-live="polite">{t('engagements.loading')}</p> : engagements.data?.length === 0 ? <div className={styles.empty}><h3>{t('engagements.emptyTitle')}</h3><p>{t('engagements.emptyDescription')}</p></div> : <div className={styles.list}>{engagements.data?.map((engagement: Engagement) => <article className={styles.row} key={engagement.id}><div><span>{engagement.status.toLowerCase()}</span><h3>{templateNames.get(engagement.templateId) ?? t('engagements.title')}</h3><p>{clientNames.get(engagement.clientId) ?? t('common.unknownClient')} · {displayDate(engagement.periodStart, t('common.noDeadline'))} to {displayDate(engagement.periodEnd, t('common.noDeadline'))}</p>{engagement.workItemId && <p>{t('engagements.boardWorkItemCreated')}</p>}</div><time dateTime={engagement.dueDate}>{t('common.due')} {displayDate(engagement.dueDate, t('common.noDeadline'))}</time></article>)}</div>}</section>
      <section className={styles.section}><div className={styles.sectionHeading}><div><h2>{t('engagements.documentRequests')}</h2><p>{t('engagements.metadataOnly')}</p></div>{canWrite && <button type="button" onClick={() => setRequestForm((open) => !open)} disabled={activeClients.length === 0}>{requestForm ? t('common.cancel') : t('engagements.request')}</button>}</div>{canWrite && requestForm && <form className={styles.form} onSubmit={submitRequest}><label>{t('common.client')}<select name="clientId" required defaultValue=""><option value="" disabled>{t('engagements.selectClient')}</option>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label><label>{t('engagements.requestLabel')}<input name="label" required maxLength={200} /></label><label>{t('engagements.secureReference')}<input name="externalReference" maxLength={1000} /></label><label>{t('common.dueDate')}<input name="dueDate" type="date" /></label><button disabled={requestResult.isLoading}>{t('engagements.sendRequest')}</button></form>}{loading ? <p aria-live="polite">{t('engagements.loadingRequests')}</p> : requests.data?.length === 0 ? <div className={styles.empty}><h3>{t('engagements.emptyRequests')}</h3><p>{t('engagements.emptyRequestsDescription')}</p></div> : <div className={styles.list}>{requests.data?.map((request: DocumentRequest) => <article className={styles.row} key={request.id}><div><span>{request.status === 'RECEIVED' ? t('engagements.statusReceived') : t('engagements.statusRequested')}</span><h3>{request.label}</h3><p>{clientNames.get(request.clientId) ?? t('common.unknownClient')} · {displayDate(request.dueDate, t('common.noDeadline'))}</p>{request.externalReference && <p>{t('engagements.reference')} {request.externalReference}</p>}</div>{canWrite && request.status === 'REQUESTED' && <button type="button" onClick={() => receive(request)}>{t('engagements.markReceived')}</button>}</article>)}</div>}</section></div>
  </section>
}
