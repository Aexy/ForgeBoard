'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export type MembershipRole = 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER' | 'READ_ONLY'
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED'

export interface Employee {
  membershipId: string
  userId: string | null
  displayName: string | null
  email: string
  role: MembershipRole
  status: MembershipStatus
}

export interface InvitationRequest {
  displayName: string
  email: string
  role: MembershipRole
}

export interface GeneratedAccessLink {
  actionId: string
  link: string
  expiresAt: string
}

type FirmMembership = { firm: FirmContext; membershipId: string }

const employeeTags = (firm: FirmContext) => [{ type: 'Employee' as const, id: firmTag(firm.firmId) }]

export const employeesApi = forgeboardApi.injectEndpoints({
  endpoints: (build) => ({
    getEmployees: build.query<Employee[], { firm: FirmContext }>({
      query: () => ({ url: 'identity/employees' }),
      providesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    generateInvitation: build.mutation<GeneratedAccessLink, { firm: FirmContext; request: InvitationRequest }>({
      query: ({ request }) => ({ url: 'identity/employees', method: 'POST', body: request }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    reissueInvitation: build.mutation<GeneratedAccessLink, FirmMembership>({
      query: ({ membershipId }) => ({ url: `identity/employees/${encodeURIComponent(membershipId)}/invitation`, method: 'POST' }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    revokeInvitation: build.mutation<void, FirmMembership>({
      query: ({ membershipId }) => ({ url: `identity/employees/${encodeURIComponent(membershipId)}/invitation`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    updateMembershipRole: build.mutation<Employee, FirmMembership & { role: MembershipRole }>({
      query: ({ membershipId, role }) => ({ url: `identity/employees/${encodeURIComponent(membershipId)}/role`, method: 'PUT', body: { role } }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    suspendMembership: build.mutation<Employee, FirmMembership>({
      query: ({ membershipId }) => ({ url: `identity/employees/${encodeURIComponent(membershipId)}/suspension`, method: 'POST' }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    reactivateMembership: build.mutation<Employee, FirmMembership>({
      query: ({ membershipId }) => ({ url: `identity/employees/${encodeURIComponent(membershipId)}/suspension`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
    removeMembership: build.mutation<void, FirmMembership>({
      query: ({ membershipId }) => ({ url: `identity/employees/${encodeURIComponent(membershipId)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firm }) => employeeTags(firm),
    }),
  }),
})

export const {
  useGenerateInvitationMutation,
  useGetEmployeesQuery,
  useReactivateMembershipMutation,
  useReissueInvitationMutation,
  useRemoveMembershipMutation,
  useRevokeInvitationMutation,
  useSuspendMembershipMutation,
  useUpdateMembershipRoleMutation,
} = employeesApi
