import type { AccessibleFirm } from '@forgeboard/api-client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string } & DefaultSession['user']
    firms: AccessibleFirm[]
    error?: 'RefreshAccessTokenError'
  }

  interface User {
    accessToken?: string
    accessTokenExpiresAt?: number
    refreshToken?: string
    firms?: AccessibleFirm[]
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    accessToken?: string
    accessTokenExpiresAt?: number
    refreshToken?: string
    firms?: AccessibleFirm[]
    error?: 'RefreshAccessTokenError'
  }
}
