'use client'

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { FirmContext } from '@/lib/firm-context'

export interface WorkflowBoard {
  id: string
  [key: string]: unknown
}

export interface WorkflowRequest {
  firm: FirmContext
  workflowId: string
}

const firmTag = (firmId: string, id?: string) => id ? `${firmId}:${id}` : firmId
// Browser calls remain same-origin. The absolute fallback only lets the
// node-based unit suite construct WHATWG Requests without a browser origin.
const proxyBaseUrl = typeof window === 'undefined'
  ? 'http://localhost:3000/api/forgeboard'
  : new URL('/api/forgeboard', window.location.origin).toString()

export const forgeboardApi = createApi({
  reducerPath: 'forgeboardApi',
  baseQuery: fetchBaseQuery({ baseUrl: proxyBaseUrl, credentials: 'same-origin' }),
  tagTypes: ['Workflow', 'Client', 'WorkItem'],
  endpoints: (build) => ({
    getWorkflowBoard: build.query<WorkflowBoard, WorkflowRequest>({
      query: ({ firm, workflowId }) => ({
        url: `workflows/${encodeURIComponent(workflowId)}`,
      }),
      providesTags: (_result, _error, { firm, workflowId }) => [
        { type: 'Workflow', id: firmTag(firm.firmId, workflowId) },
      ],
    }),
    updateWorkflow: build.mutation<WorkflowBoard, WorkflowRequest & { body: Record<string, unknown> }>({
      query: ({ firm, workflowId, body }) => ({
        url: `workflows/${encodeURIComponent(workflowId)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { firm, workflowId }) => [
        { type: 'Workflow', id: firmTag(firm.firmId, workflowId) },
      ],
    }),
  }),
})

export const { useGetWorkflowBoardQuery, useUpdateWorkflowMutation } = forgeboardApi
