export type Activity = {
  actorUserId: string | null
  actorType: 'USER' | 'SERVICE' | 'SYSTEM'
  source: 'WEB' | 'REST' | 'MCP' | 'JOB'
  action: string
  targetType: string
  targetId: string
  summary: Record<string, unknown>
  occurredAt: string
}

export type AuditTrailFilters = {
  action?: string
  actorType?: Activity['actorType']
  source?: Activity['source']
  from?: string
  to?: string
}

export type AuditTrailPage = { items: Activity[]; nextCursor: string | null }

export async function listActivity(firmId: string): Promise<Activity[]> {
  const response = await fetch('/api/activity', { credentials: 'include', headers: { 'X-ForgeBoard-Firm': firmId } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<Activity[]>
}

export async function listAuditTrail(
  firmId: string,
  filters: AuditTrailFilters,
  cursor?: string,
): Promise<AuditTrailPage> {
  const params = new URLSearchParams({ limit: '50' })
  if (filters.action) params.set('action', filters.action)
  if (filters.actorType) params.set('actorType', filters.actorType)
  if (filters.source) params.set('source', filters.source)
  if (filters.from) params.set('from', `${filters.from}T00:00:00.000Z`)
  if (filters.to) params.set('to', `${filters.to}T23:59:59.999Z`)
  if (cursor) params.set('cursor', cursor)
  const response = await fetch(`/api/activity/audit-trail?${params}`, {
    credentials: 'include', headers: { 'X-ForgeBoard-Firm': firmId },
  })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<AuditTrailPage>
}
