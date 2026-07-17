const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_QUERY_KEYS = new Set(['client', 'owner', 'due', 'priority', 'unassigned', 'task'])

export function canonicalBoardQuery(
  source: Record<string, string | string[] | undefined>,
  resolvedLegacyTaskReference?: string,
): URLSearchParams {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(source)) if (ALLOWED_QUERY_KEYS.has(key) && typeof value === 'string') query.set(key, value)
  const task = typeof source.task === 'string' ? source.task : undefined
  if (task && UUID.test(task)) {
    if (resolvedLegacyTaskReference) query.set('task', resolvedLegacyTaskReference)
    else query.delete('task')
  }
  return query
}
