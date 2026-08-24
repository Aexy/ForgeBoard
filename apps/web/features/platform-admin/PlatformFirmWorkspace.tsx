'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

import { useLanguage } from '@/app/LanguageProvider'
import {
  type MembershipRole,
  type PlatformEmployee,
  type PlatformFirm,
  useGeneratePasswordResetMutation,
  useGeneratePlatformInvitationMutation,
  useGetPlatformEmployeesQuery,
  useReactivatePlatformMembershipMutation,
  useReissuePlatformInvitationMutation,
  useRemovePlatformMembershipMutation,
  useRevokePlatformInvitationMutation,
  useSuspendPlatformMembershipMutation,
  useUpdatePlatformEmployeeRoleMutation,
} from './platform-admin-transport'
import styles from './PlatformFirmWorkspace.module.css'

const assignableRoles: MembershipRole[] = ['OWNER', 'ADMINISTRATOR', 'MANAGER', 'MEMBER', 'READ_ONLY']
const roleKey: Record<MembershipRole, 'platformAdmin.roleOwner' | 'platformAdmin.roleAdministrator' | 'platformAdmin.roleManager' | 'platformAdmin.roleMember' | 'platformAdmin.roleReadOnly'> = {
  OWNER: 'platformAdmin.roleOwner', ADMINISTRATOR: 'platformAdmin.roleAdministrator', MANAGER: 'platformAdmin.roleManager', MEMBER: 'platformAdmin.roleMember', READ_ONLY: 'platformAdmin.roleReadOnly',
}
const statusKey = {
  INVITED: 'platformAdmin.invited', ACTIVE: 'platformAdmin.active', SUSPENDED: 'platformAdmin.suspended', REMOVED: 'platformAdmin.removed',
} as const

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'object' && data && 'message' in data && typeof data.message === 'string') return data.message
    if (typeof data === 'object' && data && 'error' in data && typeof data.error === 'string') return data.error
  }
  return fallback
}

export function PlatformFirmWorkspace({ firm, onBack }: Readonly<{ firm: PlatformFirm; onBack: () => void }>) {
  const { t } = useLanguage()
  const employees = useGetPlatformEmployeesQuery(firm.id)
  const [generateInvitation, invitationResult] = useGeneratePlatformInvitationMutation()
  const [reissueInvitation, reissueResult] = useReissuePlatformInvitationMutation()
  const [revokeInvitation] = useRevokePlatformInvitationMutation()
  const [updateRole] = useUpdatePlatformEmployeeRoleMutation()
  const [suspendMembership] = useSuspendPlatformMembershipMutation()
  const [reactivateMembership] = useReactivatePlatformMembershipMutation()
  const [removeMembership] = useRemovePlatformMembershipMutation()
  const [generatePasswordReset, passwordResetResult] = useGeneratePasswordResetMutation()
  const [creating, setCreating] = useState(false)
  const [accessLink, setAccessLink] = useState<{ firmId: string; link: string; type: 'invitation' | 'reset' } | null>(null)
  const [error, setError] = useState('')
  const previousFirmId = useRef(firm.id)
  const accessLinkInput = useRef<HTMLInputElement>(null)
  const accessMutationResets = useRef<() => void>(() => {})
  accessMutationResets.current = () => { invitationResult.reset(); reissueResult.reset(); passwordResetResult.reset() }

  function resetAccessMutationResults() { accessMutationResets.current() }
  function dismissAccessLink() { setAccessLink(null); resetAccessMutationResults() }

  useEffect(() => {
    if (previousFirmId.current === firm.id) return
    previousFirmId.current = firm.id
    dismissAccessLink()
  }, [firm.id])
  useEffect(() => () => resetAccessMutationResults(), [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      const invitation = await generateInvitation({ firmId: firm.id, request: { displayName: String(data.get('displayName')), email: String(data.get('email')), role: String(data.get('role')) as MembershipRole } }).unwrap()
      setAccessLink({ firmId: firm.id, link: invitation.link, type: 'invitation' })
      resetAccessMutationResults()
      form.reset()
      setCreating(false)
    } catch (failure) { setError(errorMessage(failure, t('platformAdmin.invitationError'))) }
  }

  async function reissue(employee: PlatformEmployee) {
    setError('')
    try {
      const invitation = await reissueInvitation({ firmId: firm.id, membershipId: employee.membershipId }).unwrap()
      setAccessLink({ firmId: firm.id, link: invitation.link, type: 'invitation' })
      resetAccessMutationResults()
    } catch (failure) { setError(errorMessage(failure, t('platformAdmin.invitationError'))) }
  }

  async function revoke(employee: PlatformEmployee) {
    setError('')
    try { await revokeInvitation({ firmId: firm.id, membershipId: employee.membershipId }).unwrap() } catch (failure) { setError(errorMessage(failure, t('platformAdmin.membershipStatusError'))) }
  }

  async function setRole(employee: PlatformEmployee, role: MembershipRole) {
    setError('')
    try { await updateRole({ firmId: firm.id, membershipId: employee.membershipId, role }).unwrap() } catch (failure) { setError(errorMessage(failure, t('platformAdmin.roleError'))) }
  }

  async function setStatus(employee: PlatformEmployee) {
    const active = employee.status === 'ACTIVE'
    if (!window.confirm(t(active ? 'platformAdmin.confirmSuspendEmployee' : 'platformAdmin.confirmReactivateEmployee').replace('{employee}', employee.displayName ?? employee.email))) return
    setError('')
    try {
      if (active) await suspendMembership({ firmId: firm.id, membershipId: employee.membershipId }).unwrap()
      else await reactivateMembership({ firmId: firm.id, membershipId: employee.membershipId }).unwrap()
    } catch (failure) { setError(errorMessage(failure, t('platformAdmin.membershipStatusError'))) }
  }

  async function remove(employee: PlatformEmployee) {
    if (!window.confirm(t('platformAdmin.confirmRemoveEmployee').replace('{employee}', employee.displayName ?? employee.email))) return
    setError('')
    try { await removeMembership({ firmId: firm.id, membershipId: employee.membershipId }).unwrap() } catch (failure) { setError(errorMessage(failure, t('platformAdmin.membershipStatusError'))) }
  }

  async function resetPassword(employee: PlatformEmployee) {
    if (firm.status !== 'ACTIVE' || !employee.userId || employee.status !== 'ACTIVE') return
    setError('')
    try {
      const reset = await generatePasswordReset({ firmId: firm.id, membershipId: employee.membershipId }).unwrap()
      setAccessLink({ firmId: firm.id, link: reset.link, type: 'reset' })
      resetAccessMutationResults()
    } catch (failure) { setError(errorMessage(failure, t('platformAdmin.resetError'))) }
  }

  async function copyAccessLink() {
    const link = accessLink?.firmId === firm.id ? accessLink.link : null
    if (!link || !navigator.clipboard) return
    try { await navigator.clipboard.writeText(link) } catch { /* The read-only field remains selectable. */ }
  }

  const visibleAccessLink = accessLink?.firmId === firm.id ? accessLink : null
  const accessLabel = visibleAccessLink?.type === 'reset' ? t('platformAdmin.passwordResetLink') : t('platformAdmin.invitationLink')
  const dismissLabel = visibleAccessLink?.type === 'reset' ? t('platformAdmin.dismissPasswordResetLink') : t('platformAdmin.dismissInvitationLink')
  useEffect(() => {
    if (!visibleAccessLink || !accessLinkInput.current) return
    accessLinkInput.current.focus()
    accessLinkInput.current.select()
  }, [visibleAccessLink])

  return <section className={styles.workspace}>
    <button type="button" className={styles.back} onClick={onBack}>{t('platformAdmin.backToFirms')}</button>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{t('platformAdmin.firmWorkspace')}</p><h1>{firm.name}</h1><p>{firm.slug} · {t(firm.status === 'ACTIVE' ? 'platformAdmin.active' : 'platformAdmin.suspended')}</p></div><button type="button" onClick={() => setCreating((current) => !current)}>{creating ? t('common.cancel') : t('platformAdmin.inviteEmployee')}</button></header>
    {visibleAccessLink ? <section className={styles.accessLink} aria-live="polite"><p>{t('platformAdmin.oneTimeLink')}</p><label>{accessLabel}<input ref={accessLinkInput} aria-label={accessLabel} readOnly value={visibleAccessLink.link} onFocus={(event) => event.currentTarget.select()} /></label><div><button type="button" onClick={() => void copyAccessLink()}>{t('platformAdmin.copyAccessLink')}</button><button type="button" onClick={dismissAccessLink}>{dismissLabel}</button></div></section> : null}
    {creating ? <form className={styles.form} onSubmit={create}>
      <h2>{t('platformAdmin.inviteEmployee')}</h2>
      <label>{t('platformAdmin.employeeName')}<input name="displayName" required maxLength={160} autoComplete="name" /></label>
      <label>{t('platformAdmin.employeeEmail')}<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
      <label>{t('platformAdmin.role')}<select name="role" defaultValue="MEMBER">{assignableRoles.map((role) => <option key={role} value={role}>{t(roleKey[role])}</option>)}</select></label>
      <button disabled={invitationResult.isLoading}>{invitationResult.isLoading ? t('platformAdmin.sendingInvitation') : t('platformAdmin.sendInvitation')}</button>
    </form> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {employees.isError ? <p className={styles.error} role="alert">{t('platformAdmin.employeesLoadError')}</p> : employees.isLoading ? <p aria-live="polite">{t('platformAdmin.loadingEmployees')}</p> : employees.data?.length === 0 ? <div className={styles.empty}><h2>{t('platformAdmin.emptyEmployeesTitle')}</h2><p>{t('platformAdmin.emptyEmployeesDescription')}</p></div> : <div className={styles.list} aria-label={t('platformAdmin.employeeList')}>
      {employees.data?.map((employee) => {
        const label = employee.displayName ?? employee.email
        return <article className={styles.row} key={employee.membershipId} data-status={employee.status}>
          <div><h2>{label}</h2><p>{employee.email}</p></div>
          <label className={styles.roleLabel}><span>{t('platformAdmin.role')}</span><select aria-label={`${t('platformAdmin.role')} ${label}`} value={employee.role} disabled={employee.status === 'REMOVED'} onChange={(event) => void setRole(employee, event.target.value as MembershipRole)}>{assignableRoles.map((role) => <option key={role} value={role}>{t(roleKey[role])}</option>)}</select></label>
          <span>{t(statusKey[employee.status])}</span>
          <div className={styles.controls}>
            {employee.status === 'INVITED' ? <><button type="button" onClick={() => void reissue(employee)}>{t('platformAdmin.reissueInvitation')}</button><button type="button" className={styles.danger} onClick={() => void revoke(employee)}>{t('platformAdmin.revokeInvitation')}</button></> : null}
            {employee.status === 'ACTIVE' || employee.status === 'SUSPENDED' ? <><button type="button" className={employee.status === 'ACTIVE' ? styles.danger : undefined} onClick={() => void setStatus(employee)}>{t(employee.status === 'ACTIVE' ? 'platformAdmin.suspendEmployee' : 'platformAdmin.reactivateEmployee')}</button>{firm.status === 'ACTIVE' && employee.status === 'ACTIVE' ? <button type="button" onClick={() => void resetPassword(employee)}>{t('platformAdmin.generatePasswordReset')}</button> : null}<button type="button" className={styles.danger} onClick={() => void remove(employee)}>{t('platformAdmin.removeEmployee')}</button></> : null}
          </div>
        </article>
      })}
    </div>}
  </section>
}
