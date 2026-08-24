'use client'

import { forgeboardApi, platformTag } from '@/store/api'

export type PlatformStatus = 'ACTIVE' | 'SUSPENDED'
export type PlatformMembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
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
  userId: string | null
  displayName: string | null
  email: string
  role: MembershipRole
  status: PlatformMembershipStatus
}

export type CreatePlatformFirm = {
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  initialPassword: string
}

export type PlatformInvitationRequest = {
  displayName: string
  email: string
  role: MembershipRole
}

export type GeneratedAccessLink = { actionId: string; link: string; expiresAt: string }

const platformUrl = (path: string) => new URL(`/api/platform-admin/${path}`, window.location.origin).toString()

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
      providesTags: (_result, _error, firmId) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    generatePlatformInvitation: build.mutation<GeneratedAccessLink, { firmId: string; request: PlatformInvitationRequest }>({
      query: ({ firmId, request }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees`), method: 'POST', body: request }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    updatePlatformEmployeeRole: build.mutation<PlatformEmployee, { firmId: string; membershipId: string; role: MembershipRole }>({
      query: ({ firmId, membershipId, role }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/role`), method: 'PUT', body: { role } }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    suspendPlatformMembership: build.mutation<PlatformEmployee, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/suspension`), method: 'POST' }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    reactivatePlatformMembership: build.mutation<PlatformEmployee, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/suspension`), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    reissuePlatformInvitation: build.mutation<GeneratedAccessLink, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/invitation`), method: 'POST' }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    revokePlatformInvitation: build.mutation<void, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/invitation`), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    removePlatformMembership: build.mutation<void, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}`), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
    generatePasswordReset: build.mutation<GeneratedAccessLink, { firmId: string; membershipId: string }>({
      query: ({ firmId, membershipId }) => ({ url: platformUrl(`firms/${encodeURIComponent(firmId)}/employees/${encodeURIComponent(membershipId)}/password-reset`), method: 'POST' }),
      invalidatesTags: (_result, _error, { firmId }) => [{ type: 'PlatformEmployee', id: platformTag(firmId) }],
    }),
  }),
})

export const {
  useCreatePlatformFirmMutation,
  useGeneratePasswordResetMutation,
  useGeneratePlatformInvitationMutation,
  useGetPlatformEmployeesQuery,
  useGetPlatformFirmsQuery,
  useReactivatePlatformFirmMutation,
  useReactivatePlatformMembershipMutation,
  useReissuePlatformInvitationMutation,
  useRemovePlatformMembershipMutation,
  useRevokePlatformInvitationMutation,
  useSuspendPlatformFirmMutation,
  useSuspendPlatformMembershipMutation,
  useUpdatePlatformEmployeeRoleMutation,
} = platformAdminApi
