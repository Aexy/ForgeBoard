import 'server-only'

import { serverApi } from '@forgeboard/api-client/server'

import { auth } from '@/auth'
import { apiSessionFromRequest } from '@/lib/auth-session'
import { firmContextForSlug, type FirmContext } from '@/lib/firm-context'

export type AuthorizedFirmRoute = {
  firm: FirmContext
  api: ReturnType<typeof serverApi>
}

export type AuthorizedFirmRouteResult =
  | { kind: 'authentication-required' }
  | { kind: 'firm-not-found' }
  | { kind: 'authorized'; route: AuthorizedFirmRoute }

export async function authorizedFirmRoute(request: Request, firmSlug: string, expectedUserId?: string): Promise<AuthorizedFirmRouteResult> {
  const session = await auth()
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') return { kind: 'authentication-required' }
  if (expectedUserId && session.user.id !== expectedUserId) return { kind: 'firm-not-found' }

  const firm = firmContextForSlug(session, firmSlug)
  if (!firm) return { kind: 'firm-not-found' }

  const apiSession = await apiSessionFromRequest(request, session)
  if (!apiSession) return { kind: 'authentication-required' }

  return { kind: 'authorized', route: { firm, api: serverApi(apiSession) } }
}
