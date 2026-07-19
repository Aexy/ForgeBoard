'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export type AuditActorType = 'USER' | 'SERVICE' | 'SYSTEM'
export type AuditSource = 'WEB' | 'REST' | 'MCP' | 'JOB'
export interface AuditTrailActivity { actorUserId: string | null; actorType: AuditActorType; source: AuditSource; action: string; targetType: string; targetId: string; summary: Record<string, unknown>; occurredAt: string }
export interface AuditTrailFilters { action?: string; actorType?: AuditActorType; source?: AuditSource; from?: string; to?: string }
export interface AuditTrailPage { items: AuditTrailActivity[]; nextCursor: string | null }

export const auditApi = forgeboardApi.injectEndpoints({ endpoints: (build) => ({
  getAuditTrail: build.query<AuditTrailPage, { firm: FirmContext; filters: AuditTrailFilters; cursor?: string; size: number }>({
    query: ({ filters, cursor, size }) => { const params = new URLSearchParams({ limit: String(size) }); if (filters.action) params.set('action', filters.action); if (filters.actorType) params.set('actorType', filters.actorType); if (filters.source) params.set('source', filters.source); if (filters.from) params.set('from', `${filters.from}T00:00:00.000Z`); if (filters.to) params.set('to', `${filters.to}T23:59:59.999999999Z`); if (cursor) params.set('cursor', cursor); return { url: `activity/audit-trail?${params.toString()}` } },
    providesTags: (_result, _error, { firm, filters, cursor, size }) => [{ type: 'AuditTrail', id: firmTag(firm.firmId, JSON.stringify({ filters, cursor: cursor ?? null, size })) }],
  }),
}) })
export const { useGetAuditTrailQuery } = auditApi
