'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export interface Employee { membershipId: string; userId: string; displayName: string; email: string; role: 'OWNER' | 'ADMINISTRATOR' | 'MANAGER' | 'MEMBER' | 'READ_ONLY' }

export const employeesApi = forgeboardApi.injectEndpoints({
  endpoints: (build) => ({
    getEmployees: build.query<Employee[], { firm: FirmContext }>({ query: () => ({ url: 'identity/employees' }), providesTags: (_result, _error, { firm }) => [{ type: 'Employee', id: firmTag(firm.firmId) }] }),
    createEmployee: build.mutation<Employee, { firm: FirmContext; employee: Omit<Employee, 'membershipId' | 'userId'> & { temporaryPassword: string } }>({ query: ({ employee }) => ({ url: 'identity/employees', method: 'POST', body: employee }), invalidatesTags: (_result, _error, { firm }) => [{ type: 'Employee', id: firmTag(firm.firmId) }] }),
  }),
})

export const { useCreateEmployeeMutation, useGetEmployeesQuery } = employeesApi
