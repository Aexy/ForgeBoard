import { getToken } from 'next-auth/jwt'

import type { ApiGrant, BrowserSession } from '@forgeboard/api-client'
import type { ServerApiSession } from '@forgeboard/api-client/server'

import { serverEnvironment } from '@/lib/env'

export interface PrivateAuthToken extends ServerApiSession {
  error?: BrowserSession['error']
}

export function toPrivateToken(grant: ApiGrant, userId: string): PrivateAuthToken {
  return {
    accessToken: grant.accessToken,
    accessTokenExpiresAt: new Date(grant.accessTokenExpiresAt).getTime(),
    refreshToken: grant.refreshToken,
    user: { id: userId, email: grant.identity.email },
    firms: grant.firms,
  }
}

export function toBrowserSession(token: PrivateAuthToken): BrowserSession {
  return {
    user: token.user,
    firms: token.firms,
    ...(token.error ? { error: token.error } : {}),
  }
}

function privateGrantFrom(token: unknown): PrivateAuthToken | undefined {
  if (!token || typeof token !== 'object') return undefined

  const candidate = token as Partial<PrivateAuthToken> & { sub?: unknown; email?: unknown }
  const hasGrant = typeof candidate.accessToken === 'string'
    && typeof candidate.refreshToken === 'string'
    && typeof candidate.accessTokenExpiresAt === 'number'
    && Number.isFinite(candidate.accessTokenExpiresAt)
    && Array.isArray(candidate.firms)
  if (!hasGrant) return undefined

  const user = candidate.user
    ?? (typeof candidate.sub === 'string' && typeof candidate.email === 'string'
      ? { id: candidate.sub, email: candidate.email }
      : undefined)
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') return undefined

  return {
    accessToken: candidate.accessToken!,
    accessTokenExpiresAt: candidate.accessTokenExpiresAt!,
    refreshToken: candidate.refreshToken!,
    user,
    firms: candidate.firms!,
    ...(candidate.error ? { error: candidate.error } : {}),
  }
}

export async function apiSessionFromRequest(
  request: Request,
  browserSession: BrowserSession,
): Promise<ServerApiSession | undefined> {
  const environment = serverEnvironment()
  const privateToken = privateGrantFrom(await getToken({
    req: request,
    secret: environment.AUTH_SECRET,
    secureCookie: new URL(environment.AUTH_URL).protocol === 'https:',
  }))
  if (!privateToken || privateToken.user.id !== browserSession.user.id) return undefined

  return privateToken
}
