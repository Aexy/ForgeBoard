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

export type ClientStatus = 'ACTIVE' | 'ARCHIVED'
export interface Client { id: string; legalName: string; displayName: string; primaryEmail: string | null; status: ClientStatus; version: number }
export interface ClientDetails { legalName: string; displayName: string; primaryEmail: string }
export interface EmployeeWorkItem { id: string; title: string; workflowId: string; stageId: string; stageName: string; attention: 'NONE' | 'BLOCKED' | 'AWAITING_REVIEW'; dueDate: string | null }
export interface MyWorkDashboard { today: string; overdue: EmployeeWorkItem[]; dueSoon: EmployeeWorkItem[]; blocked: EmployeeWorkItem[]; awaitingReview: EmployeeWorkItem[]; active: EmployeeWorkItem[] }

const firmTag = (firmId: string, id?: string) => id ? `${firmId}:${id}` : firmId
// Browser calls remain same-origin. The absolute fallback only lets the
// node-based unit suite construct WHATWG Requests without a browser origin.
const proxyBaseUrl = typeof window === 'undefined'
  ? 'http://localhost:3000/api/forgeboard'
  : new URL('/api/forgeboard', window.location.origin).toString()

export const forgeboardApi = createApi({
  reducerPath: 'forgeboardApi',
  baseQuery: fetchBaseQuery({ baseUrl: proxyBaseUrl, credentials: 'same-origin' }),
  tagTypes: ['Workflow', 'Client', 'WorkItem', 'MyWork'],
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
    getMyWork: build.query<MyWorkDashboard, { firm: FirmContext }>({
      query: () => ({ url: 'dashboard/my-work' }),
      providesTags: (_result, _error, { firm }) => [{ type: 'MyWork', id: firmTag(firm.firmId) }],
    }),
    getClients: build.query<Client[], { firm: FirmContext }>({
      query: () => ({ url: 'clients' }),
      providesTags: (result, _error, { firm }) => [{ type: 'Client', id: firmTag(firm.firmId) }, ...(result ?? []).map((client) => ({ type: 'Client' as const, id: firmTag(firm.firmId, client.id) }))],
    }),
    createClient: build.mutation<Client, { firm: FirmContext; details: ClientDetails }>({
      query: ({ details }) => ({ url: 'clients', method: 'POST', body: details }),
      invalidatesTags: (_result, _error, { firm }) => [{ type: 'Client', id: firmTag(firm.firmId) }],
    }),
    archiveClient: build.mutation<Client, { firm: FirmContext; clientId: string }>({
      query: ({ clientId }) => ({ url: `clients/${encodeURIComponent(clientId)}/archive`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, { firm, clientId }) => [{ type: 'Client', id: firmTag(firm.firmId) }, { type: 'Client', id: firmTag(firm.firmId, clientId) }],
    }),
  }),
})

export const { useArchiveClientMutation, useCreateClientMutation, useGetClientsQuery, useGetMyWorkQuery, useGetWorkflowBoardQuery, useUpdateWorkflowMutation } = forgeboardApi
