'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { type AuditActorType, type AuditSource, type AuditTrailActivity, type AuditTrailFilters, useGetAuditTrailQuery } from './audit-transport'
import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'

import styles from './AuditTrail.module.css'

const actorTypes = new Set<AuditActorType>(['USER', 'SERVICE', 'SYSTEM'])
const sources = new Set<AuditSource>(['WEB', 'REST', 'MCP', 'JOB'])
const defaultSize = 50

export type AuditSearch = AuditTrailFilters & { cursor?: string; size: number }

export function auditSearchFromParams(params: URLSearchParams): AuditSearch {
  const actorType = params.get('actorType') as AuditActorType | null
  const source = params.get('source') as AuditSource | null
  let from = validDate(params.get('from'))
  let to = validDate(params.get('to'))
  if (from && to && from > to) {
    from = undefined
    to = undefined
  }
  const parsedSize = Number(params.get('size'))
  return {
    action: params.get('action') || undefined,
    actorType: actorType && actorTypes.has(actorType) ? actorType : undefined,
    source: source && sources.has(source) ? source : undefined,
    from,
    to,
    cursor: validCursor(params.get('cursor')),
    size: Number.isInteger(parsedSize) && parsedSize >= 10 && parsedSize <= 100 ? parsedSize : defaultSize,
  }
}

function validDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined
}

function validCursor(value: string | null): string | undefined {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined
  try {
    const padding = '='.repeat((4 - value.length % 4) % 4)
    const decoded = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding)
    const [occurredAt, eventId, ...remainder] = decoded.split('|')
    if (remainder.length !== 0 || !occurredAt || !eventId) return undefined
    const datePrefix = occurredAt.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(occurredAt) || validDate(datePrefix) !== datePrefix) return undefined
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId) ? value : undefined
  } catch {
    return undefined
  }
}

function auditUrl(basePath: string, search: AuditSearch): string {
  const params = new URLSearchParams()
  if (search.action) params.set('action', search.action)
  if (search.actorType) params.set('actorType', search.actorType)
  if (search.source) params.set('source', search.source)
  if (search.from) params.set('from', search.from)
  if (search.to) params.set('to', search.to)
  if (search.cursor) params.set('cursor', search.cursor)
  if (search.size !== defaultSize) params.set('size', String(search.size))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function activitySummary(activity: AuditTrailActivity): string {
  const title = activity.summary.title
  const name = activity.summary.displayName ?? activity.summary.name
  return typeof title === 'string' ? title : typeof name === 'string' ? name : 'ForgeBoard activity'
}

function actionLabel(action: string): string {
  return action.replaceAll('.', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function AuditTrail({ basePath }: Readonly<{ basePath: string }>) {
  const firm = useFirmContext()
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = auditSearchFromParams(searchParams)
  const { cursor, size, ...filters } = search
  const canView = firm.role === 'OWNER' || firm.role === 'MANAGER'
  const result = useGetAuditTrailQuery({ firm, filters, cursor, size }, { skip: !canView })

  function replace(next: Partial<AuditSearch>, resetCursor = true) {
    const updated = { ...search, ...next }
    if (resetCursor) updated.cursor = undefined
    router.replace(auditUrl(basePath, updated))
  }

  if (!canView) return <section className={styles.workspace}><h1>{t('audit.title')}</h1><p className={styles.denied} role="alert">{t('audit.denied')}</p></section>

  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{t('audit.eyebrow')}</p><h1>{t('audit.title')}</h1><p>{t('audit.description')}</p></div></header>
    <div className={styles.filters} aria-label={t('audit.filters')}>
      <label>{t('audit.action')}<input aria-label={t('audit.action')} value={search.action ?? ''} onChange={(event) => replace({ action: event.target.value || undefined })} /></label>
      <label>{t('audit.actor')}<select aria-label={t('audit.actor')} value={search.actorType ?? ''} onChange={(event) => replace({ actorType: (event.target.value || undefined) as AuditActorType | undefined })}><option value="">{t('audit.allActors')}</option><option value="USER">{t('audit.actorUser')}</option><option value="SERVICE">{t('audit.actorService')}</option><option value="SYSTEM">{t('audit.actorSystem')}</option></select></label>
      <label>{t('audit.source')}<select aria-label={t('audit.source')} value={search.source ?? ''} onChange={(event) => replace({ source: (event.target.value || undefined) as AuditSource | undefined })}><option value="">{t('audit.allSources')}</option><option value="WEB">{t('audit.sourceWeb')}</option><option value="REST">{t('audit.sourceRest')}</option><option value="MCP">{t('audit.sourceMcp')}</option><option value="JOB">{t('audit.sourceJob')}</option></select></label>
      <label>{t('audit.from')}<input aria-label={t('audit.from')} type="date" value={search.from ?? ''} onChange={(event) => replace({ from: event.target.value || undefined })} /></label>
      <label>{t('audit.to')}<input aria-label={t('audit.to')} type="date" value={search.to ?? ''} onChange={(event) => replace({ to: event.target.value || undefined })} /></label>
      <label>{t('audit.pageSize')}<select aria-label={t('audit.pageSize')} value={search.size} onChange={(event) => replace({ size: Number(event.target.value) })}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
    </div>
    {result.isError ? <p className={styles.error} role="alert">{t('audit.loadError')}</p> : result.isLoading ? <p aria-live="polite">{t('audit.loading')}</p> : result.data?.items.length === 0 ? <div className={styles.empty}><h2>{t('audit.empty')}</h2><p>{t('audit.emptyDescription')}</p></div> : <ol className={styles.list}>{result.data?.items.map((item, index) => <li key={`${item.occurredAt}-${item.targetId}-${index}`}><strong>{actionLabel(item.action)}</strong><span>{activitySummary(item)}</span><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time><small>{item.actorType.toLowerCase()} via {item.source.toLowerCase()}</small></li>)}</ol>}
    {result.data?.nextCursor && <button type="button" onClick={() => replace({ cursor: result.data?.nextCursor ?? undefined }, false)}>{t('audit.nextPage')}</button>}
  </section>
}
