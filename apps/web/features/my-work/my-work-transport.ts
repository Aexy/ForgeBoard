'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export interface EmployeeWorkItem { taskReference: string; title: string; workflowSlug: string; stageName: string; attention: 'NONE' | 'BLOCKED' | 'AWAITING_REVIEW'; dueDate: string | null }
export interface MyWorkDashboard { today: string; overdue: EmployeeWorkItem[]; dueSoon: EmployeeWorkItem[]; blocked: EmployeeWorkItem[]; awaitingReview: EmployeeWorkItem[]; active: EmployeeWorkItem[] }

export const myWorkApi = forgeboardApi.injectEndpoints({ endpoints: (build) => ({ getMyWork: build.query<MyWorkDashboard, { firm: FirmContext }>({ query: () => ({ url: 'dashboard/my-work' }), providesTags: (_result, _error, { firm }) => [{ type: 'MyWork', id: firmTag(firm.firmId) }] }) }) })
export const { useGetMyWorkQuery } = myWorkApi
