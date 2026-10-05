'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { useLanguage } from '@/app/LanguageProvider'
import { useGetClientsQuery } from '@/features/clients/clients-transport'
import { useGetEmployeesQuery } from '@/features/employees/employees-transport'
import { useGetEngagementTemplatesQuery } from '@/features/engagements/engagements-transport'
import { useFirmContext } from '@/store/firm-cache-boundary'

import { type EngagementPortfolioFilters, type PortfolioAttention, type PortfolioStatus, useGetEngagementPortfolioQuery } from './portfolio-transport'
import styles from './EngagementPortfolio.module.css'

const attentions: PortfolioAttention[] = ['OVERDUE', 'DUE_SOON', 'BLOCKED', 'UNASSIGNED', 'AWAITING_REVIEW']
const statuses: PortfolioStatus[] = ['ACTIVE', 'BLOCKED', 'AWAITING_REVIEW', 'COMPLETE', 'CANCELLED', 'ARCHIVED']
const defaultSize = 25

const validDate = (value: string | null): string | undefined => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ? value : undefined
const selected = <T extends string>(params: URLSearchParams, key: string, values: readonly T[]) => params.getAll(key).filter((value): value is T => values.includes(value as T))

export interface PortfolioSearch extends EngagementPortfolioFilters { page: number; size: number }

export function portfolioSearchFromParams(params: URLSearchParams): PortfolioSearch {
  const rawPage = Number(params.get('page'))
  const rawSize = Number(params.get('size'))
  const periodStart = validDate(params.get('periodStart'))
  const periodEnd = validDate(params.get('periodEnd'))
  return {
    q: params.get('q')?.trim().slice(0, 120) || undefined,
    clientId: params.get('clientId') || undefined,
    templateId: params.get('templateId') || undefined,
    preparerUserId: params.get('preparerUserId') || undefined,
    reviewerUserId: params.get('reviewerUserId') || undefined,
    periodStart: periodStart && (!periodEnd || periodStart <= periodEnd) ? periodStart : undefined,
    periodEnd: periodEnd && (!periodStart || periodStart <= periodEnd) ? periodEnd : undefined,
    attention: selected(params, 'attention', attentions),
    status: selected(params, 'status', statuses),
    page: Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0,
    size: Number.isInteger(rawSize) && rawSize >= 10 && rawSize <= 100 ? rawSize : defaultSize,
  }
}

function portfolioUrl(basePath: string, search: PortfolioSearch): string {
  const params = new URLSearchParams()
  if (search.q) params.set('q', search.q)
  if (search.clientId) params.set('clientId', search.clientId)
  if (search.templateId) params.set('templateId', search.templateId)
  if (search.preparerUserId) params.set('preparerUserId', search.preparerUserId)
  if (search.reviewerUserId) params.set('reviewerUserId', search.reviewerUserId)
  if (search.periodStart) params.set('periodStart', search.periodStart)
  if (search.periodEnd) params.set('periodEnd', search.periodEnd)
  search.attention.forEach((value) => params.append('attention', value))
  search.status.forEach((value) => params.append('status', value))
  if (search.page) params.set('page', String(search.page))
  if (search.size !== defaultSize) params.set('size', String(search.size))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function EngagementPortfolio({ basePath }: Readonly<{ basePath: string }>) {
  const firm = useFirmContext()
  const { t } = useLanguage()
  const router = useRouter()
  const params = useSearchParams()
  const search = portfolioSearchFromParams(params)
  const canView = firm.role === 'OWNER' || firm.role === 'MANAGER'
  const request = { firm, filters: search, page: search.page, size: search.size }
  const portfolio = useGetEngagementPortfolioQuery(request, { skip: !canView, refetchOnMountOrArgChange: true, refetchOnFocus: true })
  const clients = useGetClientsQuery({ firm }, { skip: !canView })
  const templates = useGetEngagementTemplatesQuery({ firm }, { skip: !canView })
  const employees = useGetEmployeesQuery({ firm }, { skip: !canView })

  function replace(next: Partial<PortfolioSearch>) {
    router.replace(portfolioUrl(basePath, { ...search, ...next, page: next.page ?? 0 }))
  }
  function setMulti(key: 'attention' | 'status', value: PortfolioAttention | PortfolioStatus, checked: boolean) {
    const current = search[key]
    const next = checked ? [...current, value] : current.filter((entry) => entry !== value)
    replace({ [key]: next } as Partial<PortfolioSearch>)
  }

  if (!canView) return <section className={styles.workspace}><h1>{t('portfolio.title')}</h1><p className={styles.denied} role="alert">{t('portfolio.denied')}</p></section>

  return <section className={styles.workspace}>
    {portfolio.isFetching && !portfolio.isLoading && <p role="status">{t('portfolio.updating')}</p>}
    <header className={styles.heading}><p className={styles.eyebrow}>{t('portfolio.eyebrow')}</p><h1>{t('portfolio.title')}</h1><p>{t('portfolio.description')}</p></header>
    <div className={styles.filters} aria-label={t('portfolio.filters')}>
      <label>{t('portfolio.search')}<input value={search.q ?? ''} onChange={(event) => replace({ q: event.target.value || undefined })} /></label>
      <label>{t('common.client')}<select value={search.clientId ?? ''} onChange={(event) => replace({ clientId: event.target.value || undefined })}><option value="">{t('portfolio.allClients')}</option>{clients.data?.filter((client) => client.status === 'ACTIVE').map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label>
      <label>{t('portfolio.service')}<select value={search.templateId ?? ''} onChange={(event) => replace({ templateId: event.target.value || undefined })}><option value="">{t('portfolio.allServices')}</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      <label>{t('portfolio.preparer')}<select value={search.preparerUserId ?? ''} onChange={(event) => replace({ preparerUserId: event.target.value || undefined })}><option value="">{t('portfolio.anyPreparer')}</option>{employees.data?.filter((employee) => employee.userId && employee.status === 'ACTIVE').map((employee) => <option key={employee.membershipId} value={employee.userId ?? ''}>{employee.displayName ?? employee.email}</option>)}</select></label>
      <label>{t('common.reviewer')}<select value={search.reviewerUserId ?? ''} onChange={(event) => replace({ reviewerUserId: event.target.value || undefined })}><option value="">{t('portfolio.anyReviewer')}</option>{employees.data?.filter((employee) => employee.userId && employee.status === 'ACTIVE').map((employee) => <option key={employee.membershipId} value={employee.userId ?? ''}>{employee.displayName ?? employee.email}</option>)}</select></label>
      <label>{t('portfolio.periodFrom')}<input type="date" value={search.periodStart ?? ''} onChange={(event) => replace({ periodStart: event.target.value || undefined })} /></label>
      <label>{t('portfolio.periodTo')}<input type="date" value={search.periodEnd ?? ''} onChange={(event) => replace({ periodEnd: event.target.value || undefined })} /></label>
      <fieldset className={styles.attention}><legend>{t('portfolio.attention')}</legend><div className={styles.attentionOptions}>{attentions.map((attention) => <label key={attention}><input type="checkbox" checked={search.attention.includes(attention)} onChange={(event) => setMulti('attention', attention, event.target.checked)} />{label(attention)}</label>)}</div></fieldset>
      <fieldset className={styles.attention}><legend>{t('portfolio.status')}</legend><div className={styles.attentionOptions}>{statuses.map((status) => <label key={status}><input type="checkbox" checked={search.status.includes(status)} onChange={(event) => setMulti('status', status, event.target.checked)} />{label(status)}</label>)}</div></fieldset>
      <div className={styles.filterActions}><button type="button" onClick={() => router.replace(basePath)}>{t('portfolio.reset')}</button></div>
    </div>
    {portfolio.isError ? <div className={styles.error}><p role="alert">{t('portfolio.loadError')}</p><button type="button" disabled={portfolio.isFetching} onClick={() => void portfolio.refetch()}>{portfolio.isFetching ? t('portfolio.retrying') : t('portfolio.retry')}</button></div> : portfolio.isLoading ? <p aria-live="polite">{t('portfolio.loading')}</p> : portfolio.data?.content.length === 0 ? <div className={styles.empty}><h2>{t('portfolio.empty')}</h2><p>{t('portfolio.emptyDescription')}</p></div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t('common.client')}</th><th>{t('portfolio.service')}</th><th>{t('portfolio.period')}</th><th>{t('common.dueDate')}</th><th>{t('portfolio.preparer')}</th><th>{t('common.reviewer')}</th><th>{t('portfolio.attention')}</th><th>{t('portfolio.task')}</th></tr></thead><tbody>{portfolio.data?.content.map((item) => <tr key={item.id}><td><strong>{item.clientName}</strong><div className={styles.status}>{label(item.status)}</div></td><td>{item.templateName}<div className={styles.status}>{t('portfolio.templateVersion')} {item.templateVersion}</div></td><td>{item.periodStart} – {item.periodEnd}</td><td>{item.dueDate ?? t('common.noDeadline')}</td><td>{item.preparerName ?? t('common.unassigned')}</td><td>{item.reviewerName ?? t('common.unassigned')}</td><td><div className={styles.badges}>{item.attention.map((attention) => <span className={styles.badge} key={attention}>{label(attention)}</span>)}</div></td><td>{item.taskReference ? <Link href={`/firms/${firm.firmSlug}/workflow/${item.workflowSlug}/tasks/${item.taskReference}`}>{t('portfolio.openTask')}</Link> : t('portfolio.noTask')}</td></tr>)}</tbody></table></div>}
    {portfolio.data && portfolio.data.totalPages > 1 && <nav className={styles.pagination} aria-label={t('portfolio.pagination')}><button type="button" disabled={search.page === 0} onClick={() => replace({ page: search.page - 1 })}>{t('common.previous')}</button><span>{t('portfolio.page')} {search.page + 1} / {portfolio.data.totalPages}</span><button type="button" disabled={search.page + 1 >= portfolio.data.totalPages} onClick={() => replace({ page: search.page + 1 })}>{t('common.next')}</button></nav>}
  </section>
}
