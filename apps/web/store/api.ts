'use client'

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import type { FirmContext } from '@/lib/firm-context'

export interface WorkflowBoard {
  id: string
  name: string
  stages: WorkflowStage[]
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
export type WorkPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type StageAttention = 'NONE' | 'BLOCKED' | 'AWAITING_REVIEW'
export interface WorkItem { id: string; clientId: string; stageId: string; title: string; description: string; dueDate: string | null; priority: WorkPriority; rank: number; version: number; ownerUserId: string | null; ownerDisplayName: string | null; reviewerUserId: string | null; reviewerDisplayName: string | null }
export interface WorkflowStage { id: string; name: string; attention: StageAttention; position: number; items: WorkItem[] }
export interface DocumentRequestSummary { id: string; label: string; dueDate: string | null; status: 'REQUESTED' | 'RECEIVED'; receivedAt: string | null }
export interface ActivitySummary { action: string; occurredAt: string; summary: Record<string, unknown>; actorType: string; source: string; targetId: string }
export type AuditActorType = 'USER' | 'SERVICE' | 'SYSTEM'
export type AuditSource = 'WEB' | 'REST' | 'MCP' | 'JOB'
export interface AuditTrailActivity { actorUserId: string | null; actorType: AuditActorType; source: AuditSource; action: string; targetType: string; targetId: string; summary: Record<string, unknown>; occurredAt: string }
export interface AuditTrailFilters { action?: string; actorType?: AuditActorType; source?: AuditSource; from?: string; to?: string }
export interface AuditTrailPage { items: AuditTrailActivity[]; nextCursor: string | null }
export interface WorkItemDetail { item: WorkItem; clientDisplayName: string; documentRequests: DocumentRequestSummary[]; activity: ActivitySummary[] }
export interface Employee { membershipId: string; userId: string; displayName: string; email: string; role: 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER' | 'READ_ONLY' }
export interface WorkflowFilterView { id: string; name: string; clientId: string | null; ownerUserId: string | null; dueState: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'NO_DUE_DATE' | null; priority: WorkPriority | null; unassigned: boolean | null }

const firmTag = (firmId: string, id?: string) => id ? `${firmId}:${id}` : firmId
// Browser calls remain same-origin. The absolute fallback only lets the
// node-based unit suite construct WHATWG Requests without a browser origin.
const proxyBaseUrl = typeof window === 'undefined'
  ? 'http://localhost:3000/api/forgeboard'
  : new URL('/api/forgeboard', window.location.origin).toString()

export const forgeboardApi = createApi({
  reducerPath: 'forgeboardApi',
  baseQuery: fetchBaseQuery({ baseUrl: proxyBaseUrl, credentials: 'same-origin' }),
  tagTypes: ['Workflow', 'Client', 'WorkItem', 'MyWork', 'WorkflowView', 'Employee', 'AuditTrail'],
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
    getWorkItemDetail: build.query<WorkItemDetail, WorkflowRequest & { itemId: string }>({
      query: ({ workflowId, itemId }) => ({ url: `workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(itemId)}` }),
      providesTags: (_result, _error, { firm, workflowId, itemId }) => [
        { type: 'WorkItem', id: firmTag(firm.firmId, itemId) },
        { type: 'Workflow', id: firmTag(firm.firmId, workflowId) },
      ],
    }),
    moveWorkItem: build.mutation<WorkItem, WorkflowRequest & { itemId: string; targetStageId: string; expectedVersion: number }>({
      query: ({ workflowId, itemId, targetStageId, expectedVersion }) => ({ url: `workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(itemId)}/position`, method: 'PATCH', body: { targetStageId, beforeItemId: null, afterItemId: null, expectedVersion } }),
      invalidatesTags: (_result, _error, { firm, workflowId, itemId }) => [
        { type: 'Workflow', id: firmTag(firm.firmId, workflowId) },
        { type: 'WorkItem', id: firmTag(firm.firmId, itemId) },
        { type: 'MyWork', id: firmTag(firm.firmId) },
      ],
    }),
    updateWorkItemOwner: build.mutation<WorkItem, WorkflowRequest & { itemId: string; ownerUserId: string | null }>({
      query: ({ workflowId, itemId, ownerUserId }) => ({ url: `workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(itemId)}/owner`, method: 'PUT', body: { ownerUserId } }),
      invalidatesTags: (_result, _error, { firm, workflowId, itemId }) => [{ type: 'Workflow', id: firmTag(firm.firmId, workflowId) }, { type: 'WorkItem', id: firmTag(firm.firmId, itemId) }, { type: 'MyWork', id: firmTag(firm.firmId) }],
    }),
    updateWorkItemReviewer: build.mutation<WorkItem, WorkflowRequest & { itemId: string; userId: string | null }>({
      query: ({ workflowId, itemId, userId }) => ({ url: `workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(itemId)}/reviewer`, method: 'PUT', body: { userId } }),
      invalidatesTags: (_result, _error, { firm, workflowId, itemId }) => [{ type: 'Workflow', id: firmTag(firm.firmId, workflowId) }, { type: 'WorkItem', id: firmTag(firm.firmId, itemId) }],
    }),
    linkDocumentRequest: build.mutation<WorkItemDetail, WorkflowRequest & { itemId: string; requestId: string }>({
      query: ({ workflowId, itemId, requestId }) => ({ url: `workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(itemId)}/document-requests/${encodeURIComponent(requestId)}`, method: 'PUT' }),
      invalidatesTags: (_result, _error, { firm, workflowId, itemId }) => [{ type: 'WorkItem', id: firmTag(firm.firmId, itemId) }, { type: 'Workflow', id: firmTag(firm.firmId, workflowId) }],
    }),
    unlinkDocumentRequest: build.mutation<WorkItemDetail, WorkflowRequest & { itemId: string; requestId: string }>({
      query: ({ workflowId, itemId, requestId }) => ({ url: `workflows/${encodeURIComponent(workflowId)}/items/${encodeURIComponent(itemId)}/document-requests/${encodeURIComponent(requestId)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firm, workflowId, itemId }) => [{ type: 'WorkItem', id: firmTag(firm.firmId, itemId) }, { type: 'Workflow', id: firmTag(firm.firmId, workflowId) }],
    }),
    getWorkflowViews: build.query<WorkflowFilterView[], { firm: FirmContext }>({
      query: () => ({ url: 'workflows/views' }),
      providesTags: (_result, _error, { firm }) => [{ type: 'WorkflowView', id: firmTag(firm.firmId) }],
    }),
    createWorkflowView: build.mutation<WorkflowFilterView, { firm: FirmContext; view: Omit<WorkflowFilterView, 'id'> }>({
      query: ({ view }) => ({ url: 'workflows/views', method: 'POST', body: view }),
      invalidatesTags: (_result, _error, { firm }) => [{ type: 'WorkflowView', id: firmTag(firm.firmId) }],
    }),
    deleteWorkflowView: build.mutation<void, { firm: FirmContext; viewId: string }>({
      query: ({ viewId }) => ({ url: `workflows/views/${encodeURIComponent(viewId)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firm }) => [{ type: 'WorkflowView', id: firmTag(firm.firmId) }],
    }),
    getEmployees: build.query<Employee[], { firm: FirmContext }>({
      query: () => ({ url: 'identity/employees' }),
      providesTags: (_result, _error, { firm }) => [{ type: 'Employee', id: firmTag(firm.firmId) }],
    }),
    createEmployee: build.mutation<Employee, { firm: FirmContext; employee: Omit<Employee, 'membershipId' | 'userId'> & { temporaryPassword: string } }>({
      query: ({ employee }) => ({ url: 'identity/employees', method: 'POST', body: employee }),
      invalidatesTags: (_result, _error, { firm }) => [{ type: 'Employee', id: firmTag(firm.firmId) }],
    }),
    getMyWork: build.query<MyWorkDashboard, { firm: FirmContext }>({
      query: () => ({ url: 'dashboard/my-work' }),
      providesTags: (_result, _error, { firm }) => [{ type: 'MyWork', id: firmTag(firm.firmId) }],
    }),
    getAuditTrail: build.query<AuditTrailPage, { firm: FirmContext; filters: AuditTrailFilters; cursor?: string; size: number }>({
      query: ({ filters, cursor, size }) => {
        const params = new URLSearchParams({ limit: String(size) })
        if (filters.action) params.set('action', filters.action)
        if (filters.actorType) params.set('actorType', filters.actorType)
        if (filters.source) params.set('source', filters.source)
        if (filters.from) params.set('from', `${filters.from}T00:00:00.000Z`)
        if (filters.to) params.set('to', `${filters.to}T23:59:59.999999999Z`)
        if (cursor) params.set('cursor', cursor)
        return { url: `activity/audit-trail?${params.toString()}` }
      },
      providesTags: (_result, _error, { firm, filters, cursor, size }) => [{ type: 'AuditTrail', id: firmTag(firm.firmId, JSON.stringify({ filters, cursor: cursor ?? null, size })) }],
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

export const { useArchiveClientMutation, useCreateClientMutation, useCreateEmployeeMutation, useGetAuditTrailQuery, useGetClientsQuery, useGetEmployeesQuery, useGetMyWorkQuery, useGetWorkItemDetailQuery, useGetWorkflowBoardQuery, useGetWorkflowViewsQuery, useMoveWorkItemMutation, useUpdateWorkflowMutation, useUpdateWorkItemOwnerMutation, useUpdateWorkItemReviewerMutation } = forgeboardApi
