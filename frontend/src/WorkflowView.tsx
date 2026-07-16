import { FormEvent, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, listActivity } from './api/activity'
import { Client, listClients } from './api/clients'
import { Employee, listEmployees, MembershipRole } from './api/employees'
import { employeeDashboardKey } from './api/employeeDashboard'
import { useLanguage } from './i18n'
import {
  assignWorkItem,
  createWorkflow,
  createWorkItem,
  getWorkflow,
  listWorkflows,
  moveWorkItem,
  StageAttention,
  WorkflowBoard,
} from './api/workflows'

const defaultStages: Array<{ name: string; attention: StageAttention }> = [
  { name: 'Waiting on client', attention: 'NONE' },
  { name: 'In preparation', attention: 'NONE' },
  { name: 'Ready for review', attention: 'AWAITING_REVIEW' },
  { name: 'Complete', attention: 'NONE' },
]

type WorkItem = WorkflowBoard['stages'][number]['items'][number]

export function WorkflowView({ firmId, role = 'MEMBER' }: {
  firmId: string
  role?: MembershipRole
}) {
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const currentFirmId = useRef(firmId)
  currentFirmId.current = firmId
  const [dataFirmId, setDataFirmId] = useState(firmId)
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([])
  const [board, setBoard] = useState<WorkflowBoard | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [error, setError] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const hasCurrentFirmData = dataFirmId === firmId
  const visibleBoard = hasCurrentFirmData ? board : null
  const visibleWorkflows = hasCurrentFirmData ? workflows : []
  const visibleActivity = hasCurrentFirmData ? activity : []

  function isCurrentFirm() {
    return currentFirmId.current === firmId
  }

  useEffect(() => {
    let cancelled = false
    setDataFirmId(firmId)
    setWorkflows([])
    setBoard(null)
    setClients([])
    setEmployees([])
    setActivity([])
    setError('')
    setCreatingBoard(false)
    setAddingTo(null)

    Promise.all([listWorkflows(firmId), listClients(firmId)])
      .then(async ([found, clientList]) => {
        if (cancelled || !isCurrentFirm()) return
        setWorkflows(found)
        setClients(clientList.filter((client) => client.status === 'ACTIVE'))
        if (!found[0]) return
        const loadedBoard = await getWorkflow(firmId, found[0].id)
        if (!cancelled && isCurrentFirm()) setBoard(loadedBoard)
      })
      .catch(() => {
        if (!cancelled && isCurrentFirm()) setError('The workflow could not be loaded.')
      })

    return () => {
      cancelled = true
    }
  }, [firmId])

  useEffect(() => {
    let cancelled = false
    listActivity(firmId)
      .then((entries) => {
        if (!cancelled && isCurrentFirm()) setActivity(entries)
      })
      .catch(() => {
        if (!cancelled && isCurrentFirm()) setError('Recent activity could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [firmId])

  useEffect(() => {
    if (role !== 'OWNER' && role !== 'ADMINISTRATOR') {
      setEmployees([])
      return
    }
    let cancelled = false
    listEmployees(firmId)
      .then((found) => {
        if (!cancelled && isCurrentFirm()) setEmployees(found)
      })
      .catch(() => {
        if (!cancelled && isCurrentFirm()) setError('Employees could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [firmId, role])

  function refreshActivity() {
    listActivity(firmId)
      .then((entries) => {
        if (isCurrentFirm()) setActivity(entries)
      })
      .catch(() => {
        if (isCurrentFirm()) setError('Recent activity could not be loaded.')
      })
  }

  async function makeBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const stages = defaultStages
      .map((_, index) => ({
        name: String(data.get(`stage-${index}-name`)).trim(),
        attention: String(data.get(`stage-${index}-attention`)) as StageAttention,
      }))
      .filter((stage) => stage.name)
    try {
      const created = await createWorkflow(firmId, { name: String(data.get('name')), stages })
      if (!isCurrentFirm()) return
      setBoard(created)
      setWorkflows((all) => [...all, { id: created.id, name: created.name }])
      setCreatingBoard(false)
      form.reset()
      refreshActivity()
    } catch {
      if (isCurrentFirm()) setError('The workflow could not be created. Use at least two stages.')
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>, stageId: string) {
    event.preventDefault()
    if (!board) return
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const item = await createWorkItem(firmId, board.id, {
        clientId: String(data.get('clientId')),
        stageId,
        title: String(data.get('title')),
        description: String(data.get('description')),
        dueDate: String(data.get('dueDate')) || null,
        priority: String(data.get('priority')) as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
      })
      if (!isCurrentFirm()) return
      setBoard({
        ...board,
        stages: board.stages.map((stage) => stage.id === stageId
          ? { ...stage, items: [...stage.items, item] }
          : stage),
      })
      setAddingTo(null)
      refreshActivity()
    } catch {
      if (isCurrentFirm()) setError('The work item could not be created.')
    }
  }

  async function move(item: WorkItem, stageIndex: number, direction: -1 | 1) {
    if (!board) return
    const target = board.stages[stageIndex + direction]
    if (target) await persistMove(item, target.id)
  }

  async function drop(itemId: string, targetStageId: string) {
    if (!board || board.stages.some((stage) => (
      stage.id === targetStageId && stage.items.some((item) => item.id === itemId)
    ))) return
    const item = board.stages.flatMap((stage) => stage.items).find((candidate) => candidate.id === itemId)
    if (item) await persistMove(item, targetStageId)
  }

  async function persistMove(item: WorkItem, targetStageId: string) {
    if (!board) return
    try {
      await moveWorkItem(firmId, board.id, item.id, targetStageId, item.version)
      if (!isCurrentFirm()) return
      await queryClient.invalidateQueries({ queryKey: employeeDashboardKey(firmId) })
      const loadedBoard = await getWorkflow(firmId, board.id)
      if (!isCurrentFirm()) return
      setBoard(loadedBoard)
      refreshActivity()
    } catch (caught) {
      if (!isCurrentFirm()) return
      if (caught instanceof Error && caught.message.includes('409')) {
        setBoard(await getWorkflow(firmId, board.id))
        setError('This work item was changed by another user. The board was refreshed; retry your move.')
        return
      }
      setError('The work item could not be moved.')
    }
  }

  async function assign(item: WorkItem, ownerUserId: string) {
    if (!board) return
    try {
      await assignWorkItem(firmId, board.id, item.id, ownerUserId || null)
      if (!isCurrentFirm()) return
      await queryClient.invalidateQueries({ queryKey: employeeDashboardKey(firmId) })
      const loadedBoard = await getWorkflow(firmId, board.id)
      if (!isCurrentFirm()) return
      setBoard(loadedBoard)
      refreshActivity()
    } catch {
      if (isCurrentFirm()) setError('The work item could not be assigned.')
    }
  }

  return (
    <section className="workspace">
      <header>
        <div>
          <p className="eyebrow">Client work</p>
          <h1>{visibleBoard?.name ?? 'Workflows'}</h1>
          <p>Track every engagement from client request through review.</p>
        </div>
        <button onClick={() => setCreatingBoard(!creatingBoard)}>
          {creatingBoard ? 'Cancel' : '+ New workflow'}
        </button>
      </header>
      {hasCurrentFirmData && error && <p className="form-error" role="alert">{error}</p>}
      {hasCurrentFirmData && creatingBoard && (
        <form className="workflow-form" onSubmit={makeBoard}>
          <label>Workflow name<input name="name" required maxLength={160} /></label>
          {defaultStages.map((stage, index) => (
            <fieldset key={index}>
              <legend>Stage {index + 1}</legend>
              <label>
                Stage {index + 1} name
                <input name={`stage-${index}-name`} required={index < 2} maxLength={120} defaultValue={stage.name} />
              </label>
              <label>
                Stage {index + 1} attention
                <select name={`stage-${index}-attention`} defaultValue={stage.attention}>
                  <option value="NONE">Normal flow</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="AWAITING_REVIEW">Awaiting review</option>
                </select>
              </label>
            </fieldset>
          ))}
          <button className="primary-action">Create workflow</button>
        </form>
      )}
      {visibleWorkflows.length > 1 && (
        <label className="workflow-picker">
          Workflow
          <select
            value={visibleBoard?.id ?? ''}
            onChange={(event) => getWorkflow(firmId, event.target.value).then((loadedBoard) => {
              if (isCurrentFirm()) setBoard(loadedBoard)
            })}
          >
            {visibleWorkflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
            ))}
          </select>
        </label>
      )}
      {!visibleBoard ? (
        <div className="empty-state">
          <h2>No workflow yet</h2>
          <p>Create a workflow with the stages your firm uses every day.</p>
        </div>
      ) : (
        <div className="board" role="region" aria-label={`${visibleBoard.name} workflow`}>
          {visibleBoard.stages.map((stage, stageIndex) => (
            <section
              className="column"
              aria-label={`${stage.name} stage`}
              key={stage.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event.dataTransfer.getData('text/forgeboard-item'), stage.id)}
            >
              <div className="column-title"><span className="dot green" /><h2>{stage.name}</h2><span>{stage.items.length}</span></div>
              {stage.items.map((item) => (
                <article className="work-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/forgeboard-item', item.id)} key={item.id}>
                  <span className="client">{clients.find((client) => client.id === item.clientId)?.displayName ?? 'Client'}</span>
                  <h3>{item.title}</h3>
                  <p className="assignment">{t('Assigned')}: {item.ownerDisplayName ?? t('Unassigned')}</p>
                  {(role === 'OWNER' || role === 'ADMINISTRATOR') && (
                    <label>
                      Owner
                      <select aria-label={`Assign ${item.title}`} value={item.ownerUserId ?? ''} onChange={(event) => assign(item, event.target.value)}>
                        <option value="">Unassigned</option>
                        {employees.map((employee) => <option value={employee.userId} key={employee.userId}>{employee.displayName}</option>)}
                      </select>
                    </label>
                  )}
                  <div className="card-actions">
                    <button disabled={stageIndex === 0} aria-label={`Move ${item.title} left`} onClick={() => move(item, stageIndex, -1)}>{'<'}</button>
                    {item.dueDate && <span className="due">Due {item.dueDate}</span>}
                    <button disabled={stageIndex === visibleBoard.stages.length - 1} aria-label={`Move ${item.title} right`} onClick={() => move(item, stageIndex, 1)}>{'>'}</button>
                  </div>
                </article>
              ))}
              {addingTo === stage.id ? (
                <form className="item-form" onSubmit={(event) => addItem(event, stage.id)}>
                  <label>Client<select name="clientId" required>{clients.map((client) => <option value={client.id} key={client.id}>{client.displayName}</option>)}</select></label>
                  <label>Title<input name="title" required maxLength={200} /></label>
                  <label>Due date<input name="dueDate" type="date" /></label>
                  <label>Priority<select name="priority" defaultValue="NORMAL"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label>
                  <label>Description<textarea name="description" maxLength={10000} /></label>
                  <button className="primary-action" disabled={!clients.length}>Save work item</button>
                </form>
              ) : (
                <button className="add-card" disabled={!clients.length} onClick={() => setAddingTo(stage.id)}>+ Add work item</button>
              )}
            </section>
          ))}
        </div>
      )}
      <aside className="activity-panel" aria-labelledby="activity-title">
        <div><p className="eyebrow">Audit trail</p><h2 id="activity-title">Recent activity</h2></div>
        {visibleActivity.length === 0 ? <p>No activity recorded yet.</p> : (
          <ol>{visibleActivity.slice(0, 10).map((entry, index) => <li key={`${entry.occurredAt}-${entry.targetId}-${index}`}><strong>{describeAction(entry.action)}</strong><span>{describeSummary(entry.action, entry.summary, visibleBoard)}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time><small>{entry.actorType.toLowerCase()} via {entry.source.toLowerCase()}</small></li>)}</ol>
        )}
      </aside>
    </section>
  )
}

function describeAction(action: string) {
  const known: Record<string, string> = {
    'workflow.created': 'Workflow created', 'work-item.created': 'Work item created', 'work-item.moved': 'Work item moved', 'client.created': 'Client created', 'client.archived': 'Client archived', 'firm.created': 'Firm created',
  }
  return known[action] ?? action.replaceAll('.', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function describeSummary(action: string, summary: Record<string, unknown>, board: WorkflowBoard | null) {
  const text = (key: string) => typeof summary[key] === 'string' ? summary[key] as string : null
  if (action === 'work-item.created') return text('title') ?? 'New work item'
  if (action === 'work-item.moved') {
    const stageName = (id: string | null) => board?.stages.find((stage) => stage.id === id)?.name
    const from = stageName(text('fromStageId'))
    const to = stageName(text('toStageId'))
    return from && to ? `${from} to ${to}` : to ? `Moved to ${to}` : 'Workflow stage changed'
  }
  if (action === 'workflow.created') {
    const name = text('name') ?? 'New workflow'
    const stageCount = typeof summary.stageCount === 'number' ? summary.stageCount : null
    return stageCount === null ? name : `${name} - ${stageCount} stages`
  }
  if (action === 'client.created' || action === 'client.archived') return text('displayName') ?? 'Client record updated'
  if (action === 'firm.created') return text('firmName') ?? 'Firm workspace created'
  return 'ForgeBoard activity'
}
