import 'server-only'

import { headers } from 'next/headers'
import { serverApi } from '@forgeboard/api-client/server'

import { auth } from '@/auth'
import { apiSessionFromRequest } from '@/lib/auth-session'
import { firmContextForSlug } from '@/lib/firm-context'
import { serverEnvironment } from '@/lib/env'

type PublicWorkflow = { workflowSlug: string }
type PublicTask = { item: { taskReference: string } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidRouteValue(value: string): boolean {
  return UUID.test(value)
}

async function authenticatedWorkflowRequest<T>(firmSlug: string, path: string): Promise<T | undefined> {
  const session = await auth()
  const firm = session?.user?.id ? firmContextForSlug(session, firmSlug) : undefined
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError' || !firm) return undefined

  const cookie = (await headers()).get('cookie') ?? ''
  const request = new Request(serverEnvironment().FORGEBOARD_PUBLIC_ORIGIN, { headers: { cookie } })
  const apiSession = await apiSessionFromRequest(request, session)
  if (!apiSession) return undefined

  const response = await serverApi(apiSession).response({ path, firmId: firm.firmId })
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
