'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export type PortfolioAttention = 'OVERDUE' | 'DUE_SOON' | 'BLOCKED' | 'UNASSIGNED' | 'AWAITING_REVIEW'
export type PortfolioStatus = 'ACTIVE' | 'BLOCKED' | 'AWAITING_REVIEW' | 'COMPLETE' | 'CANCELLED' | 'ARCHIVED'

export interface EngagementPortfolioFilters {
  q?: string
  clientId?: string
  templateId?: string
  preparerUserId?: string
  reviewerUserId?: string
  periodStart?: string
  periodEnd?: string
  attention: PortfolioAttention[]
  status: PortfolioStatus[]
}

export interface EngagementPortfolioItem {
  id: string
  clientId: string
  clientName: string
  templateId: string
  templateName: string
  templateVersion: number
  preparerUserId: string | null
  preparerName: string | null
  reviewerUserId: string | null
  reviewerName: string | null
  periodStart: string
  periodEnd: string
  dueDate: string | null
  status: PortfolioStatus
  workflowSlug: string
  taskReference: string | null
  attention: PortfolioAttention[]
}

export interface EngagementPortfolioPage {
  content: EngagementPortfolioItem[]
  page: number
  pageSize: number
  totalElements: number
  totalPages: number
}

export interface EngagementPortfolioRequest {
  firm: FirmContext
  filters: EngagementPortfolioFilters
  page: number
  size: number
}

function portfolioUrl({ filters, page, size }: Omit<EngagementPortfolioRequest, 'firm'>): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(size) })
  if (filters.q) params.set('q', filters.q)
  if (filters.clientId) params.set('clientId', filters.clientId)
  if (filters.templateId) params.set('templateId', filters.templateId)
  if (filters.preparerUserId) params.set('preparerUserId', filters.preparerUserId)
  if (filters.reviewerUserId) params.set('reviewerUserId', filters.reviewerUserId)
  if (filters.periodStart) params.set('periodStart', filters.periodStart)
  if (filters.periodEnd) params.set('periodEnd', filters.periodEnd)
  filters.attention.forEach((attention) => params.append('attention', attention))
  filters.status.forEach((status) => params.append('status', status))
  return `engagements/portfolio?${params.toString()}`
}

export const portfolioApi = forgeboardApi.injectEndpoints({ endpoints: (build) => ({
  getEngagementPortfolio: build.query<EngagementPortfolioPage, EngagementPortfolioRequest>({
    query: ({ filters, page, size }) => ({ url: portfolioUrl({ filters, page, size }) }),
    providesTags: (_result, _error, { firm }) => [{
      type: 'EngagementPortfolio',
      id: firmTag(firm.firmId),
    }],
  }),
}) })

export const { useGetEngagementPortfolioQuery } = portfolioApi
