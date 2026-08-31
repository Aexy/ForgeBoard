'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { Client } from '@/features/clients/clients-transport'
import type { FirmContext } from '@/lib/firm-context'
import type { EngagementTemplate } from './engagements-transport'
import { useEnrollTemplateClientsMutation, useGetTemplateEnrollmentsQuery, useUnenrollTemplateClientsMutation } from './engagements-transport'
import styles from './TemplateClientAssignments.module.css'

type AssignmentAction = 'add' | 'remove'

const clientCount = (count: number) => `${count} selected client${count === 1 ? '' : 's'}`

export function TemplateClientAssignments({ template, clients, firm, onClose }: Readonly<{ template: EngagementTemplate; clients: Client[]; firm: FirmContext; onClose: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const enrollment = useGetTemplateEnrollmentsQuery({ firm, templateId: template.id })
  const [enroll, enrolling] = useEnrollTemplateClientsMutation()
  const [unenroll, unenrolling] = useUnenrollTemplateClientsMutation()
  const activeClients = useMemo(() => clients.filter((client) => client.status === 'ACTIVE'), [clients])
  const matchingClients = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase()
    return normalized ? activeClients.filter((client) => client.displayName.toLocaleLowerCase().includes(normalized) || client.legalName.toLocaleLowerCase().includes(normalized)) : activeClients
  }, [activeClients, search])
  const matchingIds = matchingClients.map((client) => client.id)
  const allMatchingSelected = matchingIds.length > 0 && matchingIds.every((id) => selected.has(id))
  const busy = enrolling.isLoading || unenrolling.isLoading

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    closeButton.current?.focus()
    return () => dialog.current?.close()
  }, [])

  function close() {
    dialog.current?.close()
    opener.current?.focus()
    onClose()
  }

  function toggleClient(clientId: string) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(clientId) ? next.delete(clientId) : next.add(clientId)
      return next
    })
  }

  function toggleMatching() {
    setSelected((current) => {
      const next = new Set(current)
      if (allMatchingSelected) matchingIds.forEach((id) => next.delete(id))
      else matchingIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function changeAssignments(action: AssignmentAction) {
    const clientIds = [...selected]
    if (clientIds.length === 0) return
    const verb = action === 'add' ? 'Add' : 'Remove'
    if (!window.confirm(`${verb} ${clientCount(clientIds.length)} ${action === 'add' ? 'to' : 'from'} ${template.name}?`)) return
    setError('')
    try {
      const mutation = action === 'add' ? enroll : unenroll
      await mutation({ firm, templateId: template.id, clientIds }).unwrap()
      setSelected(new Set())
    } catch {
      setError(`Client assignments could not be ${action === 'add' ? 'updated' : 'removed'}.`)
    }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="template-client-assignments-title" onCancel={(event) => { event.preventDefault(); close() }}>
    <section className={styles.content}>
      <header className={styles.heading}><div><h2 id="template-client-assignments-title">Clients for {template.name}</h2><p>{template.enrolledClientCount} enrolled active client{template.enrolledClientCount === 1 ? '' : 's'}</p></div><button ref={closeButton} type="button" onClick={close} aria-label={`Close client assignments for ${template.name}`}>Close</button></header>
      <label className={styles.search}>Search active clients<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <p aria-live="polite">{matchingClients.length} matching client{matchingClients.length === 1 ? '' : 's'}</p>
      {enrollment.isLoading ? <p aria-live="polite">Loading enrolled clients…</p> : enrollment.isError ? <p role="alert">Enrolled clients could not be loaded.</p> : <>
        <label className={styles.master}><input type="checkbox" checked={allMatchingSelected} onChange={toggleMatching} disabled={matchingIds.length === 0 || busy} aria-label={`Select all ${matchingIds.length} matching clients`} />Select all matching active clients</label>
        <ul className={styles.clients}>{matchingClients.map((client) => <li key={client.id}><label><input type="checkbox" checked={selected.has(client.id)} onChange={() => toggleClient(client.id)} disabled={busy} aria-label={client.displayName} />{client.displayName}{enrollment.data?.some((enrolled) => enrolled.id === client.id) ? <span>Enrolled</span> : null}</label></li>)}</ul>
      </>}
      {error && <p role="alert">{error}</p>}
      <footer className={styles.actions}><button type="button" onClick={() => void changeAssignments('add')} disabled={selected.size === 0 || busy}>Add {clientCount(selected.size)}</button><button type="button" onClick={() => void changeAssignments('remove')} disabled={selected.size === 0 || busy}>Remove {clientCount(selected.size)}</button></footer>
    </section>
  </dialog>
}
