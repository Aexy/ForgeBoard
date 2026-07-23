'use client'

import { forgeboardApi, platformTag } from '@/store/api'

export type PlatformStatus = 'ACTIVE' | 'SUSPENDED'
export type MembershipRole = 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER' | 'READ_ONLY'

export type PlatformFirm = {
  id: string
  name: string
  slug: string
  status: PlatformStatus
  createdAt: string
  employeeCount: number
}

export type PlatformFirmPage = { firms: PlatformFirm[]; nextCursor: string | null }

export type PlatformEmployee = {
  membershipId: string
  userId: string
  displayName: string
  email: string
  role: MembershipRole
  status: PlatformStatus
}

export type CreatePlatformFirm = {
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  initialPassword: string
}

export type CreatePlatformEmployee = {
  displayName: string
  email: string
  initialPassword: string
  role: MembershipRole
}

const platformUrl = (path: string) => `/api/platform-admin/${path}`

export const platformAdminApi = forgeboardApi.injectEndpoints({
  endpoints: (build) => ({
    getPlatformFirms: build.query<PlatformFirmPage, { query?: string }>({
      query: ({ query }) => ({ url: platformUrl(`firms${query ? `?query=${encodeURIComponent(query)}` : ''}`) }),
      providesTags: (result) => [
        { type: 'PlatformFirm', id: platformTag() },
        ...(result?.firms ?? []).map((firm) => ({ type: 'PlatformFirm' as const, id: platformTag(firm.id) })),
      ],
    }),
    createPlatformFirm: build.mutation<PlatformFirm, CreatePlatformFirm>({
      query: (firm) => ({ url: platformUrl('firms'), method: 'POST', body: firm }),
      invalidatesTags: [{ type: 'PlatformFirm', id: platformTag() }],
    }),
    suspendPlatformFirm: build.mutation<PlatformFirm, string>({
      query: (firmId) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/suspension`), method: 'POST' }),
      invalidatesTags: (_result, _error, firmId) => [{ type: 'PlatformFirm', id: platformTag() }, { type: 'PlatformFirm', id: platformTag(firmId) }],
    }),
    reactivatePlatformFirm: build.mutation<PlatformFirm, string>({
      query: (firmId) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/suspension`), method: 'DELETE' }),
      invalidatesTags: (_result, _error, firmId) => [{ type: 'PlatformFirm', id: platformTag() }, { type: 'PlatformFirm', id: platformTag(firmId) }],
    }),
    getPlatformEmployees: build.query<PlatformEmployee[], string>({
      query: (firmId) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees`) }),
      providesTags: (result, _error, firmId) => [
        { type: 'PlatformEmployee', id: platformTag(firmId) },
        ...(result ?? []).map((employee) => ({ type: 'PlatformEmployee' as const, id: platformTag(employee.membershipId) })),
      ],
    }),
    createPlatformEmployee: build.mutation<PlatformEmployee, { firmId: string; employee: CreatePlatformEmployee }>({
      query: ({ firmId, employee }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees`), method: 'POST', body: employee }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    updatePlatformEmployeeRole: build.mutation<PlatformEmployee, { firmId: string; membershipId: string; role: MembershipRole }>({
      query: ({ firmId, membershipId, role }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/role`), method: 'PUT', body: { role } }),
      invalidatesTags: (_result, _error, { firmId, membershipId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }, { type: 'PlatformEmployee', id: platformTag(membershipId) }],
    }),
    suspendPlatformMembership: build.mutation<PlatformEmployee, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/suspension`), method: 'POST' }),
      invalidatesTags: (_result, _error, { firmId, membershipId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }, { type: 'PlatformEmployee', id: platformTag(membershipId) }],
    }),
    reactivatePlatformMembership: build.mutation<PlatformEmployee, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/suspension`), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firmId, membershipId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }, { type: 'PlatformEmployee', id: platformTag(membershipId) }],
    }),
  }),
})

export const {
  useCreatePlatformEmployeeMutation,
  useCreatePlatformFirmMutation,
  useGetPlatformEmployeesQuery,
  useGetPlatformFirmsQuery,
  useReactivatePlatformFirmMutation,
  useReactivatePlatformMembershipMutation,
  useSuspendPlatformFirmMutation,
  useSuspendPlatformMembershipMutation,
  useUpdatePlatformEmployeeRoleMutation,
} = platformAdminApi
