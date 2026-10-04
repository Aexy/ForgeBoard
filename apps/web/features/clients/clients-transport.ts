'use client'

import type { FirmContext } from '@/lib/firm-context'
import { firmTag, forgeboardApi } from '@/store/api'

export type ClientStatus = 'ACTIVE' | 'ARCHIVED'
export interface Client { id: string; legalName: string; displayName: string; primaryEmail: string | null; status: ClientStatus; version: number }
export interface ClientDetails { legalName: string; displayName: string; primaryEmail: string }
export interface ClientImportResult {
  dryRun: boolean; totalRows: number; validRows: number; importedRows: number
  rows: Array<{ rowNumber: number; legalName: string | null; displayName: string | null; primaryEmail: string | null; errors: string[] }>
}

export const clientsApi = forgeboardApi.injectEndpoints({
  endpoints: (build) => ({
    importClients: build.mutation<ClientImportResult, { firm: FirmContext; csv: string; dryRun: boolean }>({
      query: ({ csv, dryRun }) => ({ url: `clients/import?dryRun=${dryRun}`, method: 'POST', headers: { 'Content-Type': 'text/csv; charset=utf-8' }, body: csv }),
      invalidatesTags: (result, _error, { firm, dryRun }) => !dryRun && result && result.importedRows > 0 ? [{ type: 'Client', id: firmTag(firm.firmId) }] : [],
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

export const { useArchiveClientMutation, useCreateClientMutation, useGetClientsQuery, useImportClientsMutation } = clientsApi
