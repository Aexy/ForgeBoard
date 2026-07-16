import type { ApiGrant, BrowserSession } from '@forgeboard/api-client'
import type { ServerApiSession } from '@forgeboard/api-client/server'

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
