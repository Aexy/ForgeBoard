'use client'

import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { signOut } from 'next-auth/react'

export const forgeboardTagTypes = ['Workflow', 'Client', 'WorkItem', 'MyWork', 'WorkflowView', 'Employee', 'AuditTrail', 'Engagement', 'EngagementTemplate', 'DocumentRequest', 'PlatformFirm', 'PlatformEmployee'] as const
export type ForgeboardTagType = typeof forgeboardTagTypes[number]

export const firmTag = (firmId: string, id?: string) => id ? `${firmId}:${id}` : firmId

/** Platform administration is deliberately not firm-scoped. */
export const platformTag = (id?: string) => id ?? 'LIST'

// Browser calls remain same-origin. The absolute fallback only lets the
// node-based unit suite construct WHATWG Requests without a browser origin.
const proxyBaseUrl = typeof window === 'undefined'
  ? 'http://localhost:3000/api/forgeboard'
  : new URL('/api/forgeboard', window.location.origin).toString()

const rawBaseQuery = fetchBaseQuery({ baseUrl: proxyBaseUrl, credentials: 'same-origin' })
let reauthenticating = false

const authenticatedBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  const requiresFreshSignIn = 'error' in result
    && result.error?.status === 401
    && result.meta?.response?.headers.get('x-forgeboard-reauthenticate') === '1'

  if (requiresFreshSignIn && !reauthenticating) {
    reauthenticating = true
    void Promise.resolve(signOut({ callbackUrl: '/sign-in' })).finally(() => { reauthenticating = false })
  }
  return result
}

export const forgeboardApi = createApi({
  reducerPath: 'forgeboardApi',
  baseQuery: authenticatedBaseQuery,
  tagTypes: forgeboardTagTypes,
  endpoints: () => ({}),
})
