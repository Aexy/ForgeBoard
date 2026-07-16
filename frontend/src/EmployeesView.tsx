import { FormEvent, useEffect, useState } from 'react'
import {
  createEmployee,
  Employee,
  listEmployees,
  MembershipRole,
} from './api/employees'

export function EmployeesView({ firmId }: { firmId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadedFirmId, setLoadedFirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const isCurrentFirm = loadedFirmId === firmId

  useEffect(() => {
    let cancelled = false
    setEmployees([])
    setError('')
    setLoading(true)

    listEmployees(firmId)
      .then((found) => {
        if (!cancelled) setEmployees(found)
      })
      .catch(() => {
        if (!cancelled) setError('Employees could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedFirmId(firmId)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [firmId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    try {
      const employee = await createEmployee(firmId, {
        displayName: String(data.get('displayName')),
        email: String(data.get('email')),
        temporaryPassword: String(data.get('temporaryPassword')),
        role: String(data.get('role')) as MembershipRole,
      })
      setEmployees((all) => [...all, employee])
      form.reset()
    } catch {
      setError('The employee could not be created. Review the details and try again.')
    }
  }

  return (
    <section className="workspace">
      <header>
        <div>
          <p className="eyebrow">Firm access</p>
          <h1>Employees</h1>
          <p>Create staff logins and make them available for work-item assignment.</p>
        </div>
      </header>
      <form className="client-form" onSubmit={submit}>
        <label>
          Employee name
          <input name="displayName" required maxLength={160} autoComplete="name" />
        </label>
        <label>
          Work email
          <input name="email" type="email" required maxLength={320} autoComplete="email" />
        </label>
        <label>
          Temporary password
          <input name="temporaryPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" />
        </label>
        <label>
          Role
          <select name="role" defaultValue="MEMBER">
            <option value="MEMBER">Member</option>
            <option value="MANAGER">Manager</option>
            <option value="READ_ONLY">Read only</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
        </label>
        <button className="primary-action">Create employee</button>
      </form>
      {isCurrentFirm && error && <p className="form-error" role="alert">{error}</p>}
      {!isCurrentFirm || loading ? (
        <p className="empty-state">Loading employees…</p>
      ) : employees.length === 0 ? (
        <div className="empty-state">
          <h2>No employees yet</h2>
          <p>Create the first employee login for this firm.</p>
        </div>
      ) : (
        <div className="client-list" aria-label="Employees">
          {employees.map((employee) => (
            <article className="client-row" key={employee.membershipId}>
              <div>
                <h2>{employee.displayName}</h2>
                <p>{employee.email}</p>
              </div>
              <span className="status">{employee.role.toLowerCase()}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
