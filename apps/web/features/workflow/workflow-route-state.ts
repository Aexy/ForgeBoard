export interface BoardFilters {
  client: string
  owner: string
  due: string
  priority: string
  unassigned: boolean
}

type SearchParams = Pick<URLSearchParams, 'get' | 'getAll' | 'entries'>
type RouteQuery = Record<string, string | string[] | undefined>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const filterKeys = ['client', 'owner', 'due', 'priority'] as const
const allowedQueryKeys = new Set([...filterKeys, 'unassigned', 'task'])

export function filtersFromSearch(search: Pick<URLSearchParams, 'get'>): BoardFilters {
  return {
    client: search.get('client') ?? '',
    owner: search.get('owner') ?? '',
    due: search.get('due') ?? '',
    priority: search.get('priority') ?? '',
    unassigned: search.get('unassigned') === 'true',
  }
}

export function canonicalBoardQuery(source: RouteQuery, resolvedLegacyTaskReference?: string): URLSearchParams {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(source)) {
    if (allowedQueryKeys.has(key) && typeof value === 'string') query.set(key, value)
  }
  const task = typeof source.task === 'string' ? source.task : undefined
  if (task && UUID.test(task)) {
    if (resolvedLegacyTaskReference) query.set('task', resolvedLegacyTaskReference)
    else query.delete('task')
  }
  return query
}

export function isCanonicalBoardQuery(source: RouteQuery) {
  const query = canonicalBoardQuery(source)
  const entries = Object.entries(source)
  return entries.length === query.size && entries.every(([key, value]) => allowedQueryKeys.has(key) && typeof value === 'string' && query.get(key) === value)
}

function canonicalSearchQuery(search: SearchParams) {
  const query = new URLSearchParams()
  for (const [key, value] of search.entries()) {
    if (!allowedQueryKeys.has(key) || search.getAll(key).length !== 1) continue
    if (key !== 'task' || !UUID.test(value)) query.set(key, value)
  }
  return query
}

function pathWithQuery(basePath: string, query: URLSearchParams) {
  return `${basePath}${query.size ? `?${query}` : ''}`
}

export function boardPathWithoutTask(basePath: string, search: SearchParams) {
  const query = canonicalSearchQuery(search)
  query.delete('task')
  return pathWithQuery(basePath, query)
}

export function taskPanelPath(basePath: string, search: SearchParams, taskReference: string) {
  const query = canonicalSearchQuery(search)
  query.set('task', taskReference)
  return pathWithQuery(basePath, query)
}

export function taskWorkspacePath(basePath: string, taskReference: string) {
  return `${basePath}/tasks/${taskReference}`
}

export function filteredBoardPath(basePath: string, search: SearchParams, next: Partial<BoardFilters>) {
  const query = canonicalSearchQuery(search)
  const values = { ...filtersFromSearch(search), ...next }
  for (const key of filterKeys) {
    if (values[key]) query.set(key, values[key])
    else query.delete(key)
  }
  if (values.unassigned) query.set('unassigned', 'true')
  else query.delete('unassigned')
  query.delete('task')
  return pathWithQuery(basePath, query)
}
