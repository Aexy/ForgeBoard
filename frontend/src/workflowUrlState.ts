export type WorkflowUrlState = { workflow: string | null; client: string | null; owner: string | null; due: string | null; priority: string | null; unassigned: boolean; item: string | null; workspace: boolean }

const keys = ['workflow', 'client', 'owner', 'due', 'priority', 'unassigned', 'item'] as const

export function readWorkflowUrlState(): WorkflowUrlState {
  const query = new URLSearchParams(window.location.search)
  return { workflow: query.get('workflow'), client: query.get('client'), owner: query.get('owner'), due: query.get('due'), priority: query.get('priority'), unassigned: query.get('unassigned') === 'true', item: query.get('item'), workspace: window.location.hash === '#task' }
}

export function writeWorkflowUrlState(state: WorkflowUrlState, replace = false) {
  const query = new URLSearchParams()
  for (const key of keys) {
    const value = state[key]
    if (value === true) query.set(key, 'true')
    else if (typeof value === 'string' && value) query.set(key, value)
  }
  const url = `${window.location.pathname}${query.toString() ? `?${query}` : ''}${state.workspace ? '#task' : ''}`
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
}
