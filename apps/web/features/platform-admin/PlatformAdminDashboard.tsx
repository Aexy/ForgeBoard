'use client'

import { FormEvent, useState } from 'react'

import { useLanguage } from '@/app/LanguageProvider'
import {
  type PlatformFirm,
  useCreatePlatformFirmMutation,
  useGetPlatformFirmsQuery,
  useReactivatePlatformFirmMutation,
  useSuspendPlatformFirmMutation,
} from './platform-admin-transport'
import { PlatformFirmWorkspace } from './PlatformFirmWorkspace'
import styles from './PlatformAdminDashboard.module.css'

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'object' && data && 'message' in data && typeof data.message === 'string') return data.message
    if (typeof data === 'object' && data && 'error' in data && typeof data.error === 'string') return data.error
  }
  return fallback
}

export function PlatformAdminDashboard() {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedFirm, setSelectedFirm] = useState<PlatformFirm | null>(null)
  const [error, setError] = useState('')
  const firms = useGetPlatformFirmsQuery({ query: submittedQuery || undefined })
  const [createFirm, createResult] = useCreatePlatformFirmMutation()
  const [suspendFirm] = useSuspendPlatformFirmMutation()
  const [reactivateFirm] = useReactivatePlatformFirmMutation()

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      const firm = await createFirm({
        name: String(data.get('name')),
        slug: String(data.get('slug')),
        ownerName: String(data.get('ownerName')),
        ownerEmail: String(data.get('ownerEmail')),
        initialPassword: String(data.get('initialPassword')),
      }).unwrap()
      form.reset()
      setCreating(false)
      setSelectedFirm(firm)
    } catch (failure) {
      setError(errorMessage(failure, t('platformAdmin.createFirmError')))
    }
  }

  async function changeFirmStatus(firm: PlatformFirm) {
    const suspend = firm.status === 'ACTIVE'
    if (!window.confirm(t(suspend ? 'platformAdmin.confirmSuspendFirm' : 'platformAdmin.confirmReactivateFirm').replace('{firm}', firm.name))) return
    setError('')
    try {
      const updated = suspend ? await suspendFirm(firm.id).unwrap() : await reactivateFirm(firm.id).unwrap()
      if (selectedFirm?.id === updated.id) setSelectedFirm(updated)
    } catch (failure) {
      setError(errorMessage(failure, t('platformAdmin.firmStatusError')))
    }
  }

  if (selectedFirm) return <PlatformFirmWorkspace firm={selectedFirm} onBack={() => setSelectedFirm(null)} />

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{t('platformAdmin.eyebrow')}</p><h1>{t('platformAdmin.title')}</h1><p>{t('platformAdmin.description')}</p></div>
      <button type="button" onClick={() => setCreating((current) => !current)}>{creating ? t('common.cancel') : t('platformAdmin.newFirm')}</button>
    </header>

    <form className={styles.search} onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query.trim()) }}>
      <label htmlFor="platform-firm-search">{t('platformAdmin.searchLabel')}</label>
      <div><input id="platform-firm-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={160} /><button>{t('platformAdmin.search')}</button></div>
    </form>

    {creating ? <form className={styles.form} onSubmit={create}>
      <h2>{t('platformAdmin.createFirm')}</h2>
      <label>{t('platformAdmin.firmName')}<input name="name" required maxLength={160} /></label>
      <label>{t('platformAdmin.firmSlug')}<input name="slug" required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
      <label>{t('platformAdmin.ownerName')}<input name="ownerName" required maxLength={160} autoComplete="name" /></label>
      <label>{t('platformAdmin.ownerEmail')}<input name="ownerEmail" type="email" required maxLength={320} autoComplete="email" /></label>
      <label>{t('platformAdmin.initialPassword')}<input name="initialPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /></label>
      <button disabled={createResult.isLoading}>{createResult.isLoading ? t('platformAdmin.creatingFirm') : t('platformAdmin.createFirm')}</button>
    </form> : null}

    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {firms.isError ? <p className={styles.error} role="alert">{t('platformAdmin.loadError')}</p> : firms.isLoading ? <p aria-live="polite">{t('platformAdmin.loading')}</p> : firms.data?.firms.length === 0 ? <div className={styles.empty}><h2>{t('platformAdmin.emptyTitle')}</h2><p>{t('platformAdmin.emptyDescription')}</p></div> : <div className={styles.list} aria-label={t('platformAdmin.firmList')}>
      {firms.data?.firms.map((firm) => <article className={styles.row} key={firm.id} data-status={firm.status}>
        <div><h2>{firm.name}</h2><p>{firm.slug} · {firm.employeeCount} {t('platformAdmin.employees')}</p></div>
        <span>{t(firm.status === 'ACTIVE' ? 'platformAdmin.active' : 'platformAdmin.suspended')}</span>
        <button type="button" onClick={() => setSelectedFirm(firm)}>{t('platformAdmin.manageEmployees')}</button>
        <button type="button" className={firm.status === 'ACTIVE' ? styles.danger : undefined} onClick={() => void changeFirmStatus(firm)}>{t(firm.status === 'ACTIVE' ? 'platformAdmin.suspendFirm' : 'platformAdmin.reactivateFirm')}</button>
      </article>)}
    </div>}
  </section>
}
