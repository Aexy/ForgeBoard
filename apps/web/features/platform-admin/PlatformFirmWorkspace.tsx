'use client'

import { FormEvent, useState } from 'react'

import { useLanguage } from '@/app/LanguageProvider'
import {
  type MembershipRole,
  type PlatformFirm,
  useCreatePlatformEmployeeMutation,
  useGetPlatformEmployeesQuery,
  useReactivatePlatformMembershipMutation,
  useSuspendPlatformMembershipMutation,
  useUpdatePlatformEmployeeRoleMutation,
} from './platform-admin-transport'
import styles from './PlatformFirmWorkspace.module.css'

const assignableRoles: MembershipRole[] = ['OWNER', 'ADMINISTRATOR', 'MANAGER', 'MEMBER', 'READ_ONLY']
const roleKey: Record<MembershipRole, 'platformAdmin.roleOwner' | 'platformAdmin.roleAdministrator' | 'platformAdmin.roleManager' | 'platformAdmin.roleMember' | 'platformAdmin.roleReadOnly'> = {
  OWNER: 'platformAdmin.roleOwner', ADMINISTRATOR: 'platformAdmin.roleAdministrator', MANAGER: 'platformAdmin.roleManager', MEMBER: 'platformAdmin.roleMember', READ_ONLY: 'platformAdmin.roleReadOnly',
}

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
  const [createEmployee, createResult] = useCreatePlatformEmployeeMutation()
  const [updateRole] = useUpdatePlatformEmployeeRoleMutation()
  const [suspendMembership] = useSuspendPlatformMembershipMutation()
  const [reactivateMembership] = useReactivatePlatformMembershipMutation()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      await createEmployee({ firmId: firm.id, employee: { displayName: String(data.get('displayName')), email: String(data.get('email')), initialPassword: String(data.get('initialPassword')), role: String(data.get('role')) as MembershipRole } }).unwrap()
      form.reset()
      setCreating(false)
    } catch (failure) { setError(errorMessage(failure, t('platformAdmin.provisionError'))) }
  }

  async function setRole(membershipId: string, role: MembershipRole) {
    setError('')
    try { await updateRole({ firmId: firm.id, membershipId, role }).unwrap() } catch (failure) { setError(errorMessage(failure, t('platformAdmin.roleError'))) }
  }

  async function setStatus(membershipId: string, displayName: string, active: boolean) {
    if (!window.confirm(t(active ? 'platformAdmin.confirmSuspendEmployee' : 'platformAdmin.confirmReactivateEmployee').replace('{employee}', displayName))) return
    setError('')
    try {
      if (active) await suspendMembership({ firmId: firm.id, membershipId }).unwrap()
      else await reactivateMembership({ firmId: firm.id, membershipId }).unwrap()
    } catch (failure) { setError(errorMessage(failure, t('platformAdmin.membershipStatusError'))) }
  }

  return <section className={styles.workspace}>
    <button type="button" className={styles.back} onClick={onBack}>{t('platformAdmin.backToFirms')}</button>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{t('platformAdmin.firmWorkspace')}</p><h1>{firm.name}</h1><p>{firm.slug} · {t(firm.status === 'ACTIVE' ? 'platformAdmin.active' : 'platformAdmin.suspended')}</p></div><button type="button" onClick={() => setCreating((current) => !current)}>{creating ? t('common.cancel') : t('platformAdmin.provisionEmployee')}</button></header>
    {creating ? <form className={styles.form} onSubmit={create}>
      <h2>{t('platformAdmin.provisionEmployee')}</h2>
      <label>{t('platformAdmin.employeeName')}<input name="displayName" required maxLength={160} autoComplete="name" /></label>
      <label>{t('platformAdmin.employeeEmail')}<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
      <label>{t('platformAdmin.initialPassword')}<input name="initialPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /></label>
      <label>{t('platformAdmin.role')}<select name="role" defaultValue="MEMBER">{assignableRoles.map((role) => <option key={role} value={role}>{t(roleKey[role])}</option>)}</select></label>
      <button disabled={createResult.isLoading}>{createResult.isLoading ? t('platformAdmin.provisioningEmployee') : t('platformAdmin.provisionEmployee')}</button>
    </form> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {employees.isError ? <p className={styles.error} role="alert">{t('platformAdmin.employeesLoadError')}</p> : employees.isLoading ? <p aria-live="polite">{t('platformAdmin.loadingEmployees')}</p> : employees.data?.length === 0 ? <div className={styles.empty}><h2>{t('platformAdmin.emptyEmployeesTitle')}</h2><p>{t('platformAdmin.emptyEmployeesDescription')}</p></div> : <div className={styles.list} aria-label={t('platformAdmin.employeeList')}>
      {employees.data?.map((employee) => <article className={styles.row} key={employee.membershipId} data-status={employee.status}>
        <div><h2>{employee.displayName}</h2><p>{employee.email}</p></div>
        <label className={styles.roleLabel}><span>{t('platformAdmin.role')}</span><select aria-label={`${t('platformAdmin.role')} ${employee.displayName}`} value={employee.role} onChange={(event) => void setRole(employee.membershipId, event.target.value as MembershipRole)}>{assignableRoles.map((role) => <option key={role} value={role}>{t(roleKey[role])}</option>)}</select></label>
        <span>{t(employee.status === 'ACTIVE' ? 'platformAdmin.active' : 'platformAdmin.suspended')}</span>
        <button type="button" className={employee.status === 'ACTIVE' ? styles.danger : undefined} onClick={() => void setStatus(employee.membershipId, employee.displayName, employee.status === 'ACTIVE')}>{t(employee.status === 'ACTIVE' ? 'platformAdmin.suspendEmployee' : 'platformAdmin.reactivateEmployee')}</button>
      </article>)}
    </div>}
  </section>
}
