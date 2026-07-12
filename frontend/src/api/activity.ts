export type Activity = {
  actorUserId: string | null
  actorType: 'USER' | 'SYSTEM' | 'AGENT'
  source: 'WEB' | 'MCP' | 'SYSTEM'
  action: string
  targetType: string
  targetId: string
  summary: Record<string, unknown>
  occurredAt: string
}

export async function listActivity(firmId: string): Promise<Activity[]> {
  const response = await fetch('/api/activity', { credentials: 'include', headers: { 'X-ForgeBoard-Firm': firmId } })
  if (!response.ok) throw new Error(`ForgeBoard request failed with ${response.status}`)
  return response.json() as Promise<Activity[]>
}
