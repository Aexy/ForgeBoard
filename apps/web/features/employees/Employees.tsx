'use client'

import { type FormEvent, useEffect, useState } from 'react'

import { useLanguage } from '@/app/LanguageProvider'
import { useFirmContext } from '@/store/firm-cache-boundary'
import {
  type Employee,
  type MembershipRole,
  useGenerateInvitationMutation,
  useGetEmployeesQuery,
  useReactivateMembershipMutation,
  useReissueInvitationMutation,
  useRemoveMembershipMutation,
  useRevokeInvitationMutation,
  useSuspendMembershipMutation,
  useUpdateMembershipRoleMutation,
} from './employees-transport'

import styles from './Employees.module.css'

const allAssignableRoles: MembershipRole[] = ['OWNER', 'ADMINISTRATOR', 'MANAGER', 'MEMBER', 'READ_ONLY']
const roleMessageKey = {
  MEMBER: 'employees.roleMember', OWNER: 'employees.roleOwner', MANAGER: 'employees.roleManager',
  READ_ONLY: 'employees.roleReadOnly', ADMINISTRATOR: 'employees.roleAdministrator',
} as const
const statusMessageKey = {
  INVITED: 'employees.statusInvited', ACTIVE: 'employees.statusActive', SUSPENDED: 'employees.statusSuspended', REMOVED: 'employees.statusRemoved',
} as const

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'object' && data && 'message' in data && typeof data.message === 'string') return data.message
    if (typeof data === 'object' && data && 'error' in data && typeof data.error === 'string') return data.error
  }
  return fallback
}

export function Employees() {
  const { t } = useLanguage()
  const firm = useFirmContext()
  const canManageMemberships = firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR'
  const allowedRoles = firm.role === 'OWNER' ? allAssignableRoles : allAssignableRoles.filter((role) => role !== 'OWNER')
  const employees = useGetEmployeesQuery({ firm }, { skip: !canManageMemberships })
  const [generateInvitation, invitationResult] = useGenerateInvitationMutation()
  const [reissueInvitation] = useReissueInvitationMutation()
  const [revokeInvitation] = useRevokeInvitationMutation()
  const [updateRole] = useUpdateMembershipRoleMutation()
  const [suspendMembership] = useSuspendMembershipMutation()
  const [reactivateMembership] = useReactivateMembershipMutation()
  const [removeMembership] = useRemoveMembershipMutation()
  const [creating, setCreating] = useState(false)
  const [accessLink, setAccessLink] = useState<{ firmId: string; link: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { setAccessLink(null) }, [firm.firmId])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      const invitation = await generateInvitation({
        firm,
        request: {
          displayName: String(data.get('displayName')),
          email: String(data.get('email')),
          role: String(data.get('role')) as MembershipRole,
        },
      }).unwrap()
      setAccessLink({ firmId: firm.firmId, link: invitation.link })
      form.reset()
      setCreating(false)
    } catch (failure) { setError(errorMessage(failure, t('employees.invitationError'))) }
  }

  async function reissue(employee: Employee) {
    setError('')
    try { setAccessLink({ firmId: firm.firmId, link: (await reissueInvitation({ firm, membershipId: employee.membershipId }).unwrap()).link }) } catch (failure) { setError(errorMessage(failure, t('employees.invitationError'))) }
  }

  async function revoke(employee: Employee) {
    setError('')
    try { await revokeInvitation({ firm, membershipId: employee.membershipId }).unwrap() } catch (failure) { setError(errorMessage(failure, t('employees.membershipError'))) }
  }

  async function setRole(employee: Employee, role: MembershipRole) {
    setError('')
    try { await updateRole({ firm, membershipId: employee.membershipId, role }).unwrap() } catch (failure) { setError(errorMessage(failure, t('employees.membershipError'))) }
  }

  async function setStatus(employee: Employee) {
    setError('')
    try {
      if (employee.status === 'ACTIVE') await suspendMembership({ firm, membershipId: employee.membershipId }).unwrap()
      else await reactivateMembership({ firm, membershipId: employee.membershipId }).unwrap()
    } catch (failure) { setError(errorMessage(failure, t('employees.membershipError'))) }
  }

  async function remove(employee: Employee) {
    if (!window.confirm(t('employees.confirmRemove').replace('{employee}', employee.displayName ?? employee.email))) return
    setError('')
    try { await removeMembership({ firm, membershipId: employee.membershipId }).unwrap() } catch (failure) { setError(errorMessage(failure, t('employees.membershipError'))) }
  }

  async function copyAccessLink() {
    const link = accessLink?.firmId === firm.firmId ? accessLink.link : null
    if (!link || !navigator.clipboard) return
    try { await navigator.clipboard.writeText(link) } catch { /* The selectable field remains a safe fallback. */ }
  }

  if (!canManageMemberships) {
    return <section className={styles.workspace}><div className={styles.denied} role="alert"><h1>{t('employees.title')}</h1><p>{t('employees.denied')}</p></div></section>
  }

  const visibleAccessLink = accessLink?.firmId === firm.firmId ? accessLink.link : null

  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{t('employees.eyebrow')}</p><h1>{t('employees.title')}</h1><p>{t('employees.description')}</p></div></header>
    {visibleAccessLink ? <section className={styles.accessLink} aria-live="polite">
      <p>{t('employees.oneTimeLink')}</p>
      <label>{t('employees.invitationLink')}<input aria-label={t('employees.invitationLink')} readOnly value={visibleAccessLink} onFocus={(event) => event.currentTarget.select()} /></label>
      <div><button type="button" onClick={() => void copyAccessLink()}>{t('employees.copyInvitationLink')}</button><button type="button" onClick={() => setAccessLink(null)}>{t('employees.dismissInvitationLink')}</button></div>
    </section> : null}
    <details className={styles.createPanel} open={creating} onToggle={(event) => setCreating(event.currentTarget.open)}>
      <summary>{creating ? t('employees.cancelNew') : t('employees.new')}</summary>
      <form className={styles.form} onSubmit={create}>
        <label>{t('employees.name')}<input name="displayName" required maxLength={160} autoComplete="name" /></label>
        <label>{t('employees.email')}<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
        <label>{t('employees.role')}<select name="role" defaultValue="MEMBER">{allowedRoles.map((role) => <option key={role} value={role}>{t(roleMessageKey[role])}</option>)}</select></label>
        <button disabled={invitationResult.isLoading}>{invitationResult.isLoading ? t('employees.sendingInvitation') : t('employees.sendInvitation')}</button>
      </form>
    </details>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {employees.isError ? <p className={styles.error} role="alert">{t('employees.loadError')}</p> : employees.isLoading ? <p aria-live="polite">{t('employees.loading')}</p> : employees.data?.length === 0 ? <div className={styles.empty}><h2>{t('employees.emptyTitle')}</h2><p>{t('employees.emptyDescription')}</p></div> : <div className={styles.list} aria-label={t('employees.title')}>
      {employees.data?.map((employee) => {
        const label = employee.displayName ?? employee.email
        const canManageEmployee = firm.role === 'OWNER' || employee.role !== 'OWNER'
        return <article className={styles.row} key={employee.membershipId} data-status={employee.status}>
          <div><h2>{label}</h2><p>{employee.email}</p></div>
          <span>{t(statusMessageKey[employee.status])}</span>
          {canManageEmployee ? <div className={styles.controls}>
            <label>{t('employees.role')}<select aria-label={`${t('employees.role')} ${label}`} value={employee.role} onChange={(event) => void setRole(employee, event.target.value as MembershipRole)} disabled={employee.status === 'REMOVED'}>{allowedRoles.map((role) => <option key={role} value={role}>{t(roleMessageKey[role])}</option>)}</select></label>
            {employee.status === 'INVITED' ? <><button type="button" onClick={() => void reissue(employee)}>{t('employees.reissueInvitation')}</button><button type="button" className={styles.danger} onClick={() => void revoke(employee)}>{t('employees.revokeInvitation')}</button></> : null}
            {employee.status === 'ACTIVE' || employee.status === 'SUSPENDED' ? <><button type="button" className={employee.status === 'ACTIVE' ? styles.danger : undefined} onClick={() => void setStatus(employee)}>{t(employee.status === 'ACTIVE' ? 'employees.suspendAccess' : 'employees.reactivateAccess')}</button><button type="button" className={styles.danger} onClick={() => void remove(employee)}>{t('employees.removeAccess')}</button></> : null}
          </div> : null}
        </article>
      })}
    </div>}
  </section>
}
