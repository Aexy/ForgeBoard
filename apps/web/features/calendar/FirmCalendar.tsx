'use client'

import { type FormEvent, useMemo, useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'

import { type FirmClosure, useCreateFirmClosureMutation, useDeleteFirmClosureMutation, useGetFirmCalendarQuery } from './firm-calendar-transport'
import styles from './FirmCalendar.module.css'

const currentYear = () => new Date().getFullYear()
const canManageCalendar = (role: string) => role === 'OWNER' || role === 'ADMINISTRATOR' || role === 'MANAGER'

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${date}T12:00:00`))
}

export function FirmCalendar() {
  const firm = useFirmContext()
  const [year, setYear] = useState(currentYear)
  const [error, setError] = useState('')
  const canManage = canManageCalendar(firm.role)
  const calendar = useGetFirmCalendarQuery({ firm, year }, { skip: !canManage })
  const [createClosure, createResult] = useCreateFirmClosureMutation()
  const [deleteClosure, deleteResult] = useDeleteFirmClosureMutation()
  const years = useMemo(() => [currentYear() - 1, currentYear(), currentYear() + 1], [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createClosure({ firm, year, closure: { closureDate: String(data.get('date')), label: String(data.get('label')).trim() } }).unwrap()
      form.reset()
    } catch {
      setError('The firm closure could not be saved. Review the date and try again.')
    }
  }

  async function remove(closure: FirmClosure) {
    setError('')
    try {
      await deleteClosure({ firm, year, closureId: closure.id }).unwrap()
    } catch {
      setError('The firm closure could not be removed. Refresh the calendar and try again.')
    }
  }

  if (!canManage) return <section className={styles.workspace}><h1>Firm calendar</h1><p className={styles.error} role="alert">Only owners, administrators, and managers can manage the firm calendar.</p></section>

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Firm settings</p><h1>Firm calendar</h1><p>Austria&apos;s public holidays are included automatically. Add closures that should move future deadlines to the preceding business day.</p></div>
      <label className={styles.year}>Calendar year<select aria-label="Calendar year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {calendar.isLoading ? <p aria-live="polite">Loading calendar…</p> : calendar.isError ? <p className={styles.error} role="alert">The firm calendar could not be loaded. Refresh and try again.</p> : <>
      <section className={styles.timeZone} aria-label="Firm time zone"><strong>Time zone</strong><span>{calendar.data?.timezone ?? 'Europe/Vienna'}</span></section>
      <div className={styles.grid}>
        <section className={styles.section} aria-labelledby="statutory-holidays"><div><h2 id="statutory-holidays">Austrian public holidays</h2><p>These statutory dates cannot be edited here.</p></div><ol className={styles.list}>{calendar.data?.statutoryHolidays.map((holiday) => <li key={holiday.date}><time dateTime={holiday.date}>{formatDate(holiday.date)}</time><span>{holiday.label}</span></li>)}</ol></section>
        <section className={styles.section} aria-labelledby="firm-closures"><div><h2 id="firm-closures">Firm closures</h2><p>Add planned closure days for this firm only.</p></div><form className={styles.form} onSubmit={create}><label>Date<input name="date" type="date" min={`${year}-01-01`} max={`${year}-12-31`} required /></label><label>Closure name<input name="label" maxLength={160} required placeholder="Year-end office closure" /></label><button disabled={createResult.isLoading}>{createResult.isLoading ? 'Saving…' : 'Add closure'}</button></form>{calendar.data?.closures.length === 0 ? <p className={styles.empty}>No firm closures are recorded for {year}.</p> : <ol className={styles.list}>{calendar.data?.closures.map((closure) => <li key={closure.id}><div><time dateTime={closure.closureDate}>{formatDate(closure.closureDate)}</time><span>{closure.label}</span></div><button type="button" onClick={() => remove(closure)} disabled={deleteResult.isLoading}>Remove</button></li>)}</ol>}</section>
      </div>
    </>}
  </section>
}
