'use client'

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

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

export const forgeboardApi = createApi({
  reducerPath: 'forgeboardApi',
  baseQuery: fetchBaseQuery({ baseUrl: proxyBaseUrl, credentials: 'same-origin' }),
  tagTypes: forgeboardTagTypes,
  endpoints: () => ({}),
})
