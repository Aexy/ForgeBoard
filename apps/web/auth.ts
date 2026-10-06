import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { ApiGrant } from '@forgeboard/api-client'

import { serverEnvironment } from '@/lib/env'
import { privateGrantFrom, toBrowserSession, toPrivateToken, type PrivateAuthToken } from '@/lib/auth-session'

const REFRESH_EARLY_MS = 60_000
const environment = serverEnvironment()

function authEndpoint(path: string): string {
  return new URL(path.replace(/^\//, ''), `${environment.FORGEBOARD_API_BASE_URL.replace(/\/$/, '')}/`).toString()
}

async function postGrant(path: string, payload: Record<string, string | boolean>): Promise<ApiGrant> {
  const response = await fetch(authEndpoint(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Invalid API credentials')
  return response.json() as Promise<ApiGrant>
}

export async function refreshPrivateToken(token: PrivateAuthToken): Promise<PrivateAuthToken> {
  if (token.error || !Number.isFinite(token.sessionExpiresAt) || token.sessionExpiresAt <= Date.now()) return { ...token, error: 'RefreshAccessTokenError' }
  try {
    const grant = await postGrant('/api/auth/refresh', { refreshToken: token.refreshToken })
    const refreshed = toPrivateToken(grant, token.user.id)
    return { ...refreshed, sessionExpiresAt: Math.min(token.sessionExpiresAt, refreshed.sessionExpiresAt) }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

export async function revokeRefreshToken(refreshToken?: string): Promise<void> {
  if (!refreshToken) return
  try {
    await postGrant('/api/auth/revoke', { refreshToken })
  } catch {
    // Signing out must clear the browser session even when Spring is unavailable.
  }
}

export const authConfig = {
  providers: [
    Credentials({
      name: 'ForgeBoard credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        remember: { label: 'Remember me', type: 'checkbox' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password) return null
        if (credentials.remember !== undefined && ![true, false, 'true', 'false'].includes(credentials.remember as string | boolean)) return null
        const remember = credentials.remember === true || credentials.remember === 'true'
        try {
          const grant = await postGrant('/api/auth/grant', { email, password, remember })
          const privateToken = toPrivateToken(grant, grant.identity.email)
          return { id: privateToken.user.id, email: privateToken.user.email, ...privateToken }
        } catch {
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/sign-in' },
  callbacks: {
    async jwt({ token, user }) {
      const signedInUser = user as (PrivateAuthToken & { id: string; email: string }) | undefined
      const privateToken = privateGrantFrom(signedInUser)
        ?? privateGrantFrom(token)

      // NextAuth calls this callback for anonymous JWTs too. They do not have a
      // ForgeBoard grant and must never trigger a refresh request to Spring.
      if (!privateToken) return token
      if (privateToken.error || privateToken.sessionExpiresAt <= Date.now()) return { ...token, ...privateToken, error: 'RefreshAccessTokenError' } as typeof token
      if (privateToken.accessTokenExpiresAt > Date.now() + REFRESH_EARLY_MS) return { ...token, ...privateToken } as typeof token
      const refreshed = await refreshPrivateToken(privateToken)
      return { ...token, ...refreshed, sub: refreshed.user.id, email: refreshed.user.email } as typeof token
    },
    async session({ session, token }) {
      const storedToken = privateGrantFrom(token)
      if (!storedToken) return session
      return {
        ...session,
        ...toBrowserSession({
        ...storedToken,
        user: storedToken.user ?? { id: token.sub!, email: token.email! },
        }),
      }
    },
    authorized({ auth }) {
      // A failed refresh leaves the encrypted Auth.js JWT in place long enough
      // to surface the error, but must never authorize a protected firm route.
      return Boolean(auth?.user?.id) && auth?.error !== 'RefreshAccessTokenError'
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token as { refreshToken?: string } : undefined
      await revokeRefreshToken(token?.refreshToken)
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
