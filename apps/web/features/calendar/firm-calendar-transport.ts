'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

/**
 * Firm calendar BFF contract. The server calculates the statutory dates for the
 * requested year and returns firm closures separately, so the browser never
 * infers business-day rules from a translated holiday name.
 */
export interface StatutoryHoliday {
  date: string
  label: string
}

export interface FirmClosure {
  id: string
  closureDate: string
  label: string
}

export interface FirmCalendar {
  timezone: string
  year: number
  statutoryHolidays: StatutoryHoliday[]
  closures: FirmClosure[]
}

export interface CreateFirmClosure {
  closureDate: string
  label: string
}

export const firmCalendarApi = forgeboardApi.injectEndpoints({
  endpoints: (build) => ({
    getFirmCalendar: build.query<FirmCalendar, { firm: FirmContext; year: number }>({
      query: ({ year }) => ({ url: `firm-calendar?year=${encodeURIComponent(String(year))}` }),
      providesTags: (_result, _error, { firm, year }) => [{ type: 'FirmCalendar', id: firmTag(firm.firmId, String(year)) }],
    }),
    createFirmClosure: build.mutation<FirmClosure, { firm: FirmContext; closure: CreateFirmClosure; year: number }>({
      query: ({ closure }) => ({ url: 'firm-calendar/closures', method: 'POST', body: closure }),
      invalidatesTags: (_result, _error, { firm, year }) => [{ type: 'FirmCalendar', id: firmTag(firm.firmId, String(year)) }],
    }),
    deleteFirmClosure: build.mutation<void, { firm: FirmContext; closureId: string; year: number }>({
      query: ({ closureId }) => ({ url: `firm-calendar/closures/${encodeURIComponent(closureId)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { firm, year }) => [{ type: 'FirmCalendar', id: firmTag(firm.firmId, String(year)) }],
    }),
  }),
})

export const { useCreateFirmClosureMutation, useDeleteFirmClosureMutation, useGetFirmCalendarQuery } = firmCalendarApi
