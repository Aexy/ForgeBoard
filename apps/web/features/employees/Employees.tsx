'use client'

import { type FormEvent, useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { useLanguage } from '@/app/LanguageProvider'
import { type Employee, useCreateEmployeeMutation, useGetEmployeesQuery } from './employees-transport'

import styles from './Employees.module.css'

const assignableRoles = ['MEMBER', 'MANAGER', 'READ_ONLY', 'ADMINISTRATOR'] as const

const roleMessageKey = {
  MEMBER: 'employees.roleMember',
  OWNER: 'employees.roleOwner',
  MANAGER: 'employees.roleManager',
  READ_ONLY: 'employees.roleReadOnly',
  ADMINISTRATOR: 'employees.roleAdministrator',
} as const

export function Employees() {
  const { t } = useLanguage()
  const firm = useFirmContext()
  const canManageMemberships = firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR'
  const employees = useGetEmployeesQuery({ firm }, { skip: !canManageMemberships })
  const [createEmployee, createResult] = useCreateEmployeeMutation()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')

    try {
      await createEmployee({
        firm,
        employee: {
          displayName: String(data.get('displayName')),
          email: String(data.get('email')),
          temporaryPassword: String(data.get('temporaryPassword')),
          role: String(data.get('role')) as (typeof assignableRoles)[number],
        },
      }).unwrap()
      form.reset()
      setCreating(false)
    } catch {
      setError(t('employees.createError'))
    }
  }

  if (!canManageMemberships) {
    return <section className={styles.workspace}><div className={styles.denied} role="alert"><h1>{t('employees.title')}</h1><p>{t('employees.denied')}</p></div></section>
  }

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{t('employees.eyebrow')}</p><h1>{t('employees.title')}</h1><p>{t('employees.description')}</p></div>
    </header>
    <details className={styles.createPanel} open={creating} onToggle={(event) => setCreating(event.currentTarget.open)}>
      <summary>{creating ? t('employees.cancelNew') : t('employees.new')}</summary>
      <form className={styles.form} onSubmit={create}>
        <label>{t('employees.name')}<input name="displayName" required maxLength={160} autoComplete="name" /></label>
        <label>{t('employees.email')}<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
        <label>{t('employees.temporaryPassword')}<input name="temporaryPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /></label>
        <label>{t('employees.role')}<select name="role" defaultValue="MEMBER">{assignableRoles.map((role) => <option key={role} value={role}>{t(roleMessageKey[role])}</option>)}</select></label>
        <button disabled={createResult.isLoading}>{t('employees.create')}</button>
      </form>
    </details>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {employees.isError ? <p className={styles.error} role="alert">{t('employees.loadError')}</p> : employees.isLoading ? <p aria-live="polite">{t('employees.loading')}</p> : employees.data?.length === 0 ? <div className={styles.empty}><h2>{t('employees.emptyTitle')}</h2><p>{t('employees.emptyDescription')}</p></div> : <div className={styles.list} aria-label={t('employees.title')}>{employees.data?.map((employee: Employee) => <article className={styles.row} key={employee.membershipId}><div><h2>{employee.displayName}</h2><p>{employee.email}</p></div><span>{t(roleMessageKey[employee.role])}</span></article>)}</div>}
  </section>
}
