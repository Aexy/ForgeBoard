'use client'

import { type FormEvent, useState } from 'react'

import { useFirmContext } from '@/store/firm-cache-boundary'
import { type Employee, useCreateEmployeeMutation, useGetEmployeesQuery } from './employees-transport'

import styles from './Employees.module.css'

const assignableRoles = ['MEMBER', 'MANAGER', 'READ_ONLY', 'ADMINISTRATOR'] as const

export function Employees() {
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
      setError('The employee could not be created. Review the details and try again.')
    }
  }

  if (!canManageMemberships) {
    return <section className={styles.workspace}><div className={styles.denied} role="alert"><h1>Employees</h1><p>Only owners and administrators can manage employee access.</p></div></section>
  }

  return <section className={styles.workspace}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Firm access</p><h1>Employees</h1><p>Create staff logins and make them available for work-item assignment.</p></div>
      <button type="button" onClick={() => setCreating((value) => !value)}>{creating ? 'Cancel' : '+ New employee'}</button>
    </header>
    {creating && <form className={styles.form} onSubmit={create}>
      <label>Employee name<input name="displayName" required maxLength={160} autoComplete="name" /></label>
      <label>Work email<input name="email" type="email" required maxLength={320} autoComplete="email" /></label>
      <label>Temporary password<input name="temporaryPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /></label>
      <label>Role<select name="role" defaultValue="MEMBER">{assignableRoles.map((role) => <option key={role} value={role}>{role.replace('_', ' ').toLowerCase()}</option>)}</select></label>
      <button disabled={createResult.isLoading}>Create employee</button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {employees.isError ? <p className={styles.error} role="alert">Employees could not be loaded.</p> : employees.isLoading ? <p aria-live="polite">Loading employees…</p> : employees.data?.length === 0 ? <div className={styles.empty}><h2>No employees yet</h2><p>Create the first employee login for this firm.</p></div> : <div className={styles.list} aria-label="Employees">{employees.data?.map((employee: Employee) => <article className={styles.row} key={employee.membershipId}><div><h2>{employee.displayName}</h2><p>{employee.email}</p></div><span>{employee.role.replace('_', ' ').toLowerCase()}</span></article>)}</div>}
  </section>
}
