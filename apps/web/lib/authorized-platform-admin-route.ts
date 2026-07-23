import 'server-only'

import { serverApi } from '@forgeboard/api-client/server'

import { auth } from '@/auth'
import { apiSessionFromRequest } from '@/lib/auth-session'

export type AuthorizedPlatformAdminRoute = {
  user: { id: string; email: string }
  api: ReturnType<typeof serverApi>
}

export type AuthorizedPlatformAdminRouteResult =
  | { kind: 'authentication-required' }
  | { kind: 'platform-admin-forbidden' }
  | { kind: 'authorized'; route: AuthorizedPlatformAdminRoute }

/**
 * Produces a server-only Spring transport for platform administration. Unlike
 * firm routes, this deliberately has no selected-firm input or context cookie:
 * Spring's platform-administration policy is the authority for these calls.
 */
export async function authorizedPlatformAdminRoute(request: Request): Promise<AuthorizedPlatformAdminRouteResult> {
  const session = await auth()
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') return { kind: 'authentication-required' }
  if (session.platformAdministrator !== true) return { kind: 'platform-admin-forbidden' }

  const apiSession = await apiSessionFromRequest(request, session)
  if (!apiSession) return { kind: 'authentication-required' }

  return {
    kind: 'authorized',
    route: {
      user: { id: session.user.id, email: session.user.email },
      api: serverApi(apiSession),
    },
  }
}
