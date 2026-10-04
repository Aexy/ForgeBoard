'use client'

import { useState, type FormEvent } from 'react'
import { useLanguage } from '@/app/LanguageProvider'
import { useFirmContext } from '@/store/firm-cache-boundary'
import { useImportClientsMutation, type ClientImportResult } from './clients-transport'
import styles from './Clients.module.css'

export function ClientImport() {
  const firm = useFirmContext()
  const { t } = useLanguage()
  const [importClients] = useImportClientsMutation()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ csv: string; result: ClientImportResult } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imported, setImported] = useState<number | null>(null)
  const ready = preview && preview.result.totalRows > 0 && preview.result.validRows === preview.result.totalRows

  async function run(dryRun: boolean) {
    if (busy || !file || (!dryRun && !ready)) return
    setBusy(true)
    setError('')
    setImported(null)
    const previous = preview
    setPreview(null)
    try {
      if (file.size > 1024 * 1024) { setError(t('clients.importTooLarge')); return }
      let csv = previous?.csv ?? ''
      if (dryRun) {
        const bytes = await file.arrayBuffer()
        try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
        catch { setError(t('clients.importEncoding')); return }
      }
      const result = await importClients({ firm, csv, dryRun }).unwrap()
      if (!dryRun && result.importedRows > 0) setImported(result.importedRows)
      else {
        setPreview({ csv, result })
        if (!dryRun) setError(t('clients.importRejected'))
      }
    } catch (failure) {
      const detail = (failure as { data?: { detail?: unknown } })?.data?.detail
      setError(`${t('clients.importError')}${typeof detail === 'string' ? ` ${detail}` : ''}`)
    } finally { setBusy(false) }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void run(true) }

  return <details className={styles.importPanel}>
    <summary>{t('clients.importTitle')}</summary>
    <form className={styles.form} onSubmit={submit} aria-label={t('clients.importTitle')} aria-busy={busy}>
      <p id="csv-format">{t('clients.importHelp')} <code>legalName,displayName,primaryEmail</code></p>
      <label>{t('clients.importFile')}<input type="file" accept=".csv,text/csv" required disabled={busy} aria-describedby="csv-format" onChange={(event) => {
        setFile(event.target.files?.[0] ?? null); setPreview(null); setError(''); setImported(null)
      }} /></label>
      <button disabled={busy || !file}>{busy ? t('clients.importWorking') : t('clients.importPreview')}</button>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {imported !== null && <p role="status">{t('clients.importSuccess')} {imported}</p>}
    {preview && <>
      <p role="status">{t('clients.importValidRows')} {preview.result.validRows} / {preview.result.totalRows}. {ready ? t('clients.importReady') : t('clients.importCorrect')}</p>
      <div className={styles.importTable} role="region" aria-label={t('clients.importPreview')} tabIndex={0}>
        <table><caption>{t('clients.importPreview')}</caption><thead><tr>
          <th scope="col">{t('clients.importRow')}</th><th scope="col">{t('clients.legalName')}</th><th scope="col">{t('clients.displayName')}</th><th scope="col">{t('clients.primaryEmail')}</th><th scope="col">{t('clients.importErrors')}</th>
        </tr></thead><tbody>{preview.result.rows.map((row) => <tr key={row.rowNumber}>
          <th scope="row">{row.rowNumber}</th><td>{row.legalName}</td><td>{row.displayName}</td><td>{row.primaryEmail}</td><td className={styles.error}>{row.errors.join('; ')}</td>
        </tr>)}</tbody></table>
      </div>
      <button className={styles.importCommit} type="button" disabled={busy || !ready} onClick={() => void run(false)}>{t('clients.importCommit')}</button>
    </>}
  </details>
}
