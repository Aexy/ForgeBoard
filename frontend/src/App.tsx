import { FormEvent, useEffect, useState } from 'react'
import { createFirm, currentSession, login, logout, SessionIdentity } from './api/session'

const stages = [
  { name: 'Waiting on client', count: 8, accent: 'amber' },
  { name: 'In preparation', count: 12, accent: 'blue' },
  { name: 'Ready for review', count: 5, accent: 'violet' },
  { name: 'Complete', count: 24, accent: 'green' },
]
const work = [
  { client: 'Northstar Studio', task: 'June bookkeeping', due: 'Due today', owner: 'AM' },
  { client: 'Kern & Sohn GmbH', task: 'Q2 VAT return', due: 'Due in 3 days', owner: 'JL' },
  { client: 'Riverside Dental', task: 'Payroll reconciliation', due: 'Due 18 Jul', owner: 'SK' },
]

function Board({ identity, firmName, onLogout }: { identity: SessionIdentity; firmName: string; onLogout: () => void }) {
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span>F</span> ForgeBoard</div>
      <nav aria-label="Primary navigation"><a className="active" href="#workflow">Workflow</a><a href="#clients">Clients</a><a href="#engagements">Engagements</a><a href="#reports">Reports</a></nav>
      <div className="firm-card"><small>Current firm</small><strong>{firmName}</strong><span>{identity.email}</span><button className="sidebar-action" type="button" onClick={onLogout}>Sign out</button></div>
    </aside>
    <section className="workspace" id="workflow">
      <header><div><p className="eyebrow">Client work</p><h1>Monthly accounting</h1><p>Track every engagement from client request through review.</p></div><button type="button">+ New work item</button></header>
      <div className="metrics" aria-label="Workflow summary">
        <article><strong>49</strong><span>Active items</span></article><article><strong className="danger">6</strong><span>Overdue</span></article><article><strong>8</strong><span>Waiting on clients</span></article><article><strong>5</strong><span>Awaiting review</span></article>
      </div>
      <div className="toolbar"><label><span className="sr-only">Search work</span><input placeholder="Search clients or work…" /></label><button className="secondary" type="button">Filters</button><span className="updated">Updated just now</span></div>
      <div className="board" role="region" aria-label="Monthly accounting workflow">
        {stages.map((stage, index) => <section className="column" key={stage.name}>
          <div className="column-title"><span className={`dot ${stage.accent}`} /><h2>{stage.name}</h2><span>{stage.count}</span></div>
          {index < 3 && work.slice(index, index + 2).map((item) => <article className="work-card" key={`${stage.name}-${item.client}`}><span className="client">{item.client}</span><h3>{item.task}</h3><div><span className={item.due.includes('today') ? 'due urgent' : 'due'}>{item.due}</span><span className="avatar">{item.owner}</span></div></article>)}
          <button className="add-card" type="button">+ Add work item</button>
        </section>)}
      </div>
    </section>
  </main>
}

function Access({ onAuthenticated }: { onAuthenticated: (identity: SessionIdentity, firmName?: string) => void }) {
  const [mode, setMode] = useState<'login' | 'onboarding'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email'))
    const password = String(data.get('password'))
    try {
      let firmName: string | undefined
      if (mode === 'onboarding') {
        firmName = String(data.get('firmName'))
        await createFirm({
          firmName,
          firmSlug: String(data.get('firmSlug')),
          ownerName: String(data.get('ownerName')),
          ownerEmail: email,
          password,
        })
      }
      onAuthenticated(await login(email, password), firmName)
    } catch {
      setError(mode === 'login' ? 'We could not sign you in. Check your details and try again.' : 'We could not create your firm. Review the details and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="access-shell">
    <section className="access-intro">
      <div className="brand"><span>F</span> ForgeBoard</div>
      <p className="eyebrow">Built for accounting teams</p>
      <h1>Client work, clearly moving forward.</h1>
      <p>Keep deadlines, handoffs, and missing documents visible in one shared workflow.</p>
      <ul><li>Know what needs attention today</li><li>Make every handoff auditable</li><li>Give your team and AI agents one source of truth</li></ul>
    </section>
    <section className="access-panel" aria-labelledby="access-title">
      <div className="mode-switch" aria-label="Account access">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>I have an account</button>
        <button type="button" aria-pressed={mode === 'onboarding'} onClick={() => setMode('onboarding')}>Create a firm</button>
      </div>
      <h2 id="access-title">{mode === 'login' ? 'Welcome back' : 'Set up your workspace'}</h2>
      <p>{mode === 'login' ? 'Sign in to continue to your firm.' : 'Create the first owner account for your firm.'}</p>
      <form onSubmit={submit}>
        {mode === 'onboarding' && <>
          <label>Firm name<input name="firmName" autoComplete="organization" required maxLength={160} /></label>
          <label>Workspace address<div className="slug-field"><span>forgeboard.app/</span><input name="firmSlug" aria-label="Workspace address" required maxLength={80} pattern="[a-z0-9-]+" placeholder="hearth-accounting" /></div></label>
          <label>Your name<input name="ownerName" autoComplete="name" required maxLength={160} /></label>
        </>}
        <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={12} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create firm'}</button>
      </form>
    </section>
  </main>
}

export function App() {
  const [identity, setIdentity] = useState<SessionIdentity | null>(null)
  const [checking, setChecking] = useState(true)
  const [firmName, setFirmName] = useState('Your firm')

  useEffect(() => { currentSession().then(setIdentity).catch(() => undefined).finally(() => setChecking(false)) }, [])

  if (checking) return <main className="loading-shell" aria-live="polite">Opening ForgeBoard…</main>
  if (!identity) return <Access onAuthenticated={(next, firm) => { setIdentity(next); if (firm) setFirmName(firm) }} />
  return <Board identity={identity} firmName={firmName} onLogout={async () => { await logout(); setIdentity(null) }} />
}
