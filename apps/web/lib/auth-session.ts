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

/**
 * Auth.js serializes only enumerable session properties. Keep the Spring grant
 * non-enumerable so server-side `auth()` can proxy an API request without ever
 * exposing credentials from `/api/auth/session` to browser JavaScript.
 */
export function attachPrivateApiSession<T extends BrowserSession>(
  browserSession: T,
  token: PrivateAuthToken,
): T {
  Object.defineProperty(browserSession, '__forgeboardApiSession', {
    configurable: false,
    enumerable: false,
    value: {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      user: token.user,
      firms: token.firms,
    } satisfies ServerApiSession,
    writable: false,
  })
  return browserSession
}

export function apiSessionFromRequest(
  _request: Request,
  browserSession: BrowserSession,
): ServerApiSession | undefined {
  const candidate = (browserSession as BrowserSession & { __forgeboardApiSession?: ServerApiSession }).__forgeboardApiSession
  if (!candidate || candidate.user.id !== browserSession.user.id) return undefined
  return candidate
}
