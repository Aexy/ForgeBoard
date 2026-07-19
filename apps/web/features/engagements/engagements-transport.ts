'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export type Recurrence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export interface EngagementTemplate { id: string; name: string; workflowId: string; recurrence: Recurrence; defaultWorkItemTitle: string; dueDay: number; version: number }
export interface Engagement { id: string; templateId: string; clientId: string; workflowId: string; workItemId: string | null; periodStart: string; periodEnd: string; dueDate: string; status: 'OPEN' | 'COMPLETE' | 'CANCELLED'; version: number }
export interface DocumentRequest { id: string; clientId: string; label: string; externalReference: string | null; dueDate: string | null; status: 'REQUESTED' | 'RECEIVED'; receivedAt: string | null; version: number }

export const engagementsApi = forgeboardApi.injectEndpoints({ endpoints: (build) => ({
  getEngagementTemplates: build.query<EngagementTemplate[], { firm: FirmContext }>({ query: () => ({ url: 'engagements/templates' }), providesTags: (_result, _error, { firm }) => [{ type: 'EngagementTemplate', id: firmTag(firm.firmId) }] }),
  createEngagementTemplate: build.mutation<EngagementTemplate, { firm: FirmContext; template: Omit<EngagementTemplate, 'id' | 'version'> }>({ query: ({ template }) => ({ url: 'engagements/templates', method: 'POST', body: template }), invalidatesTags: (_result, _error, { firm }) => [{ type: 'EngagementTemplate', id: firmTag(firm.firmId) }] }),
  getEngagements: build.query<Engagement[], { firm: FirmContext }>({ query: () => ({ url: 'engagements' }), providesTags: (_result, _error, { firm }) => [{ type: 'Engagement', id: firmTag(firm.firmId) }] }),
  createEngagement: build.mutation<Engagement, { firm: FirmContext; templateId: string; details: { clientId: string; periodStart: string } }>({ query: ({ templateId, details }) => ({ url: `engagements/templates/${encodeURIComponent(templateId)}/instances`, method: 'POST', body: details }), invalidatesTags: (result, _error, { firm }) => [{ type: 'Engagement', id: firmTag(firm.firmId) }, { type: 'MyWork', id: firmTag(firm.firmId) }, ...(result ? [{ type: 'Workflow' as const, id: firmTag(firm.firmId, result.workflowId) }] : [])] }),
  getDocumentRequests: build.query<DocumentRequest[], { firm: FirmContext }>({ query: () => ({ url: 'document-requests' }), providesTags: (_result, _error, { firm }) => [{ type: 'DocumentRequest', id: firmTag(firm.firmId) }] }),
  createDocumentRequest: build.mutation<DocumentRequest, { firm: FirmContext; request: Omit<DocumentRequest, 'id' | 'status' | 'receivedAt' | 'version'> }>({ query: ({ request }) => ({ url: 'document-requests', method: 'POST', body: request }), invalidatesTags: (_result, _error, { firm }) => [{ type: 'DocumentRequest', id: firmTag(firm.firmId) }] }),
  receiveDocumentRequest: build.mutation<DocumentRequest, { firm: FirmContext; requestId: string }>({ query: ({ requestId }) => ({ url: `document-requests/${encodeURIComponent(requestId)}/received`, method: 'PATCH' }), invalidatesTags: (_result, _error, { firm }) => [{ type: 'DocumentRequest', id: firmTag(firm.firmId) }, { type: 'WorkItem', id: firmTag(firm.firmId) }] }),
}) })
export const { useCreateDocumentRequestMutation, useCreateEngagementMutation, useCreateEngagementTemplateMutation, useGetDocumentRequestsQuery, useGetEngagementsQuery, useGetEngagementTemplatesQuery, useReceiveDocumentRequestMutation } = engagementsApi
