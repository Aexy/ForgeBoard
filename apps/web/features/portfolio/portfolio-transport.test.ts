// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupListeners } from '@reduxjs/toolkit/query'

import { portfolioApi, type EngagementPortfolioRequest } from './portfolio-transport'
import { makeStore, type AppStore } from '@/store/store'
import { engagementsApi } from '@/features/engagements/engagements-transport'
import { workflowApi } from '@/features/workflow/workflow-transport'
import { employeesApi } from '@/features/employees/employees-transport'

const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }
const filters = { q: 'Northstar', attention: ['OVERDUE', 'BLOCKED'] as const, status: [] as const }
const stores: AppStore[] = []
const trackedStore = () => { const store = makeStore(); stores.push(store); return store }
afterEach(() => { stores.splice(0).forEach((store) => store.dispatch(portfolioApi.util.resetApiState())); vi.unstubAllGlobals() })

const workflowItem = { firm: firmA, workflowId: 'workflow', itemId: 'item' }
const membership = { firm: firmA, membershipId: 'membership' }
const mutations = [
  ['createEngagement', (store: AppStore) => store.dispatch(engagementsApi.endpoints.createEngagement.initiate({ firm: firmA, templateId: 'template', details: { clientId: 'client', periodStart: '2026-10-01' } }))],
  ['changeEngagementLifecycle', (store: AppStore) => store.dispatch(engagementsApi.endpoints.changeEngagementLifecycle.initiate({ firm: firmA, engagementId: 'engagement', action: 'cancel', expectedVersion: 1, workflowId: 'workflow', workItemId: 'item' }))],
  ['updateEngagementTemplate', (store: AppStore) => store.dispatch(engagementsApi.endpoints.updateEngagementTemplate.initiate({ firm: firmA, templateId: 'template', expectedVersion: 1, template: { name: 'Monthly', workflowId: 'workflow', recurrence: 'MONTHLY', defaultWorkItemTitle: 'Prepare', dueDay: 15, checklistItems: [] } }))],
  ['retryRecurrenceFailure', (store: AppStore) => store.dispatch(engagementsApi.endpoints.retryRecurrenceFailure.initiate({ firm: firmA, runId: 'run' }))],
  ['generateRecurrenceFailure', (store: AppStore) => store.dispatch(engagementsApi.endpoints.generateRecurrenceFailure.initiate({ firm: firmA, runId: 'run' }))],
  ['moveWorkItem', (store: AppStore) => store.dispatch(workflowApi.endpoints.moveWorkItem.initiate({ ...workflowItem, targetStageId: 'stage', expectedVersion: 1 }))],
  ['updateWorkItemOwner', (store: AppStore) => store.dispatch(workflowApi.endpoints.updateWorkItemOwner.initiate({ ...workflowItem, ownerUserId: 'owner' }))],
  ['updateWorkItemReviewer', (store: AppStore) => store.dispatch(workflowApi.endpoints.updateWorkItemReviewer.initiate({ ...workflowItem, userId: 'reviewer' }))],
  ['suspendMembership', (store: AppStore) => store.dispatch(employeesApi.endpoints.suspendMembership.initiate(membership))],
  ['reactivateMembership', (store: AppStore) => store.dispatch(employeesApi.endpoints.reactivateMembership.initiate(membership))],
  ['removeMembership', (store: AppStore) => store.dispatch(employeesApi.endpoints.removeMembership.initiate(membership))],
] as const

async function cachedPortfolios(status = 200) {
  let reads = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request
    return new Response(JSON.stringify(request.method === 'GET'
      ? { content: [], page: 0, pageSize: 25, totalElements: ++reads, totalPages: 1 }
      : { workflowId: 'workflow' }), { status: request.method === 'GET' ? 200 : status, headers: { 'Content-Type': 'application/json' } })
  }))
  const store = trackedStore()
  const first: EngagementPortfolioRequest = { firm: firmA, filters: { attention: [], status: [] }, page: 0, size: 25 }
  const second: EngagementPortfolioRequest = { ...first, filters: { attention: ['BLOCKED'], status: ['ACTIVE'] }, page: 1 }
  const inactive: EngagementPortfolioRequest = { ...first, filters: { attention: [], status: [], q: 'inactive' } }
  const other: EngagementPortfolioRequest = { ...first, firm: firmB }
  for (const request of [first, second, inactive, other]) {
    await store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate(request, { subscribe: request !== inactive }))
  }
  const select = (request: EngagementPortfolioRequest) => portfolioApi.endpoints.getEngagementPortfolio.select(request)(store.getState())
  return { store, first, second, inactive, other, select, reads: () => reads }
}

describe('portfolio transport', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ content: [], page: 0, pageSize: 25, totalElements: 0, totalPages: 0 }), { headers: { 'Content-Type': 'application/json' } }))))

  it('uses only the same-origin BFF and retains immutable firm cache identity', async () => {
    const store = trackedStore()
    await Promise.all([
      store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate({ firm: firmA, filters: { ...filters, attention: [...filters.attention], status: [] }, page: 0, size: 25 })),
      store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate({ firm: firmB, filters: { ...filters, attention: [...filters.attention], status: [] }, page: 0, size: 25 })),
    ])
    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request)
    expect(requests).toHaveLength(2)
    expect(requests[0].url).toContain('/api/forgeboard/engagements/portfolio?')
    const parameters = new URL(requests[0].url).searchParams
    expect(parameters.getAll('attention')).toEqual(['OVERDUE', 'BLOCKED'])
    expect(Object.keys(store.getState().forgeboardApi.queries)).toHaveLength(2)
  })

  describe.each([200, 409, 403, 400])('mutation response %i', (status) => {
    it.each(mutations)('%s refreshes only the affected firm when appropriate', async (_name, mutate) => {
      const cache = await cachedPortfolios(status)
      expect(cache.reads()).toBe(4)
      await mutate(cache.store)
      await Promise.all(cache.store.dispatch(portfolioApi.util.getRunningQueriesThunk()))
      if (status === 200 || status === 409) {
        expect(cache.reads()).toBe(6)
        expect(cache.select(cache.first).data?.totalElements).toBeGreaterThan(4)
        expect(cache.select(cache.second).data?.totalElements).toBeGreaterThan(4)
        expect(cache.select(cache.inactive).isUninitialized).toBe(true)
      } else {
        expect(cache.reads()).toBe(4)
        expect(cache.select(cache.first).data?.totalElements).toBe(1)
        expect(cache.select(cache.second).data?.totalElements).toBe(2)
        expect(cache.select(cache.inactive).data?.totalElements).toBe(3)
      }
      expect(cache.select(cache.other).data?.totalElements).toBe(4)
    })
  })

  it('retains portfolio caches after an unrelated mutation', async () => {
    const cache = await cachedPortfolios()
    await cache.store.dispatch(engagementsApi.endpoints.markRecurrenceFailureSolved.initiate({ firm: firmA, runId: 'run' }))
    await Promise.all(cache.store.dispatch(portfolioApi.util.getRunningQueriesThunk()))
    expect(cache.reads()).toBe(4)
    expect([cache.first, cache.second, cache.inactive, cache.other].map((request) => cache.select(request).data?.totalElements)).toEqual([1, 2, 3, 4])
  })

  it('refreshes opted-in subscriptions on real focus and reconnect events and removes listeners on cleanup', async () => {
    const cache = await cachedPortfolios()
    const unsubscribe = setupListeners(cache.store.dispatch)
    const subscription = cache.store.dispatch(portfolioApi.endpoints.getEngagementPortfolio.initiate(cache.first, { subscriptionOptions: { refetchOnFocus: true, refetchOnReconnect: true } }))
    await subscription
    try {
      window.dispatchEvent(new Event('focus'))
      await vi.waitFor(() => expect(cache.select(cache.first).data?.totalElements).toBe(5))
      window.dispatchEvent(new Event('online'))
      await vi.waitFor(() => expect(cache.select(cache.first).data?.totalElements).toBe(6))
      expect(cache.select(cache.second).data?.totalElements).toBe(2)
      expect(cache.select(cache.other).data?.totalElements).toBe(4)
      unsubscribe()
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
      await Promise.all(cache.store.dispatch(portfolioApi.util.getRunningQueriesThunk()))
      expect(cache.reads()).toBe(6)
    } finally { unsubscribe(); subscription.unsubscribe() }
  })
})
