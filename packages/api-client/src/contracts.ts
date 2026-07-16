export type FirmRole = 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER' | 'READ_ONLY'

export interface AccessibleFirm {
  id: string
  slug: string
  name: string
  role: FirmRole
}

export interface BrowserSession {
  user: { id: string; email: string }
  firms: AccessibleFirm[]
  error?: 'RefreshAccessTokenError'
}

/** This type is intentionally exported only from the server entry point. */
export interface ServerApiSession {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string
  user: BrowserSession['user']
  firms: AccessibleFirm[]
}

export interface ApiGrant {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  identity: { email: string }
  firms: AccessibleFirm[]
}
