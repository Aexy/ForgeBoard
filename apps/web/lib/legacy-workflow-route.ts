import 'server-only'

import { headers } from 'next/headers'
import { authorizedFirmRoute } from '@/lib/authorized-firm-route'
import { serverEnvironment } from '@/lib/env'

type PublicWorkflow = { workflowSlug: string }
type PublicTask = { item: { taskReference: string } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidRouteValue(value: string): boolean {
  return UUID.test(value)
}

async function authenticatedWorkflowRequest<T>(firmSlug: string, path: string): Promise<T | undefined> {
  const cookie = (await headers()).get('cookie') ?? ''
  const request = new Request(serverEnvironment().FORGEBOARD_PUBLIC_ORIGIN, { headers: { cookie } })
  const result = await authorizedFirmRoute(request, firmSlug)
  if (result.kind !== 'authorized') return undefined

  const response = await result.route.api.response({ path, firmId: result.route.firm.firmId })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`Legacy workflow redirect lookup failed with ${response.status}`)
  return response.json() as Promise<T>
}

export function publicWorkflowForLegacyId(firmSlug: string, workflowId: string): Promise<PublicWorkflow | undefined> {
  return authenticatedWorkflowRequest(firmSlug, `/api/workflows/${encodeURIComponent(workflowId)}`)
}

export function publicTaskForLegacyIds(firmSlug: string, workflowId: string, taskId: string): Promise<PublicTask | undefined> {
  return authenticatedWorkflowRequest(firmSlug, `/api/workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(taskId)}`)
}
