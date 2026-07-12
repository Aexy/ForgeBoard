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

export function App() {
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span>F</span> ForgeBoard</div>
      <nav aria-label="Primary navigation"><a className="active" href="#workflow">Workflow</a><a href="#clients">Clients</a><a href="#engagements">Engagements</a><a href="#reports">Reports</a></nav>
      <div className="firm-card"><small>Current firm</small><strong>Hearth Accounting</strong><span>Foundation preview</span></div>
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
