// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { engagementsApi } from './engagements-transport'
import { workflowApi } from '@/features/workflow/workflow-transport'
import { makeStore } from '@/store/store'
const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }; const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }
describe('engagements transport', () => { beforeEach(() => {
  let detailResponse = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = (input as Request).url
    const body = url.includes('/instances')
      ? { id: 'engagement-1', workflowId: 'workflow-1' }
      : url.includes('workflows/public/') && !url.includes('/items/')
        ? { id: 'workflow-1', stages: [] }
        : url.includes('workflows/public/')
          ? { responseMarker: `detail-${++detailResponse}` }
          : []
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  }))
})
  it('refreshes only the generated engagement workflow board', async () => { const store = makeStore(); await Promise.all([store.dispatch(workflowApi.endpoints.getWorkflowBoard.initiate({ firm: firmA, workflowSlug: 'monthly-close' })), store.dispatch(workflowApi.endpoints.getWorkflowBoard.initiate({ firm: firmB, workflowSlug: 'monthly-close' }))]); await store.dispatch(engagementsApi.endpoints.createEngagement.initiate({ firm: firmA, templateId: 'template-1', details: { clientId: 'client-1', periodStart: '2026-07-01' } })); await new Promise((resolve) => setTimeout(resolve, 0)); const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.includes('workflows/public/monthly-close')); expect(requests).toHaveLength(3) })
  it('refreshes linked task details only in the firm receiving a document request', async () => { const store = makeStore(); await Promise.all([store.dispatch(workflowApi.endpoints.getWorkItemDetail.initiate({ firm: firmA, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })), store.dispatch(workflowApi.endpoints.getWorkItemDetail.initiate({ firm: firmB, workflowSlug: 'monthly-close', taskReference: 'FB-1042' }))]); await store.dispatch(engagementsApi.endpoints.receiveDocumentRequest.initiate({ firm: firmA, requestId: 'request-1' })); await new Promise((resolve) => setTimeout(resolve, 0)); const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.includes('workflows/public/monthly-close/items/FB-1042')); expect(requests).toHaveLength(3) })
  it('refreshes linked task details only in the firm recording reminder and escalation', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(workflowApi.endpoints.getWorkItemDetail.initiate({ firm: firmA, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })),
      store.dispatch(workflowApi.endpoints.getWorkItemDetail.initiate({ firm: firmB, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })),
    ])

    await store.dispatch(engagementsApi.endpoints.recordDocumentRequestReminder.initiate({ firm: firmA, requestId: 'request-1' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const selectFirmA = () => workflowApi.endpoints.getWorkItemDetail.select({ firm: firmA, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })(store.getState()).data as unknown as { responseMarker: string }
    const selectFirmB = () => workflowApi.endpoints.getWorkItemDetail.select({ firm: firmB, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })(store.getState()).data as unknown as { responseMarker: string }
    expect(selectFirmA().responseMarker).toBe('detail-3')
    expect(selectFirmB().responseMarker).toBe('detail-2')

    await store.dispatch(engagementsApi.endpoints.escalateDocumentRequest.initiate({ firm: firmA, requestId: 'request-1' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selectFirmA().responseMarker).toBe('detail-4')
    expect(selectFirmB().responseMarker).toBe('detail-2')
    const mutations = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.includes('/document-requests/request-1/'))
    expect(mutations.map((request) => [request.url.split('/').at(-1), request.method])).toEqual([['reminded', 'PATCH'], ['escalated', 'PATCH']])
  })
  it('invalidates lifecycle detail only for the initiating firm', async () => { const store = makeStore(); await Promise.all([store.dispatch(engagementsApi.endpoints.getEngagement.initiate({ firm: firmA, engagementId: 'engagement-1' })), store.dispatch(engagementsApi.endpoints.getEngagement.initiate({ firm: firmB, engagementId: 'engagement-1' }))]); await store.dispatch(engagementsApi.endpoints.changeEngagementLifecycle.initiate({ firm: firmA, engagementId: 'engagement-1', action: 'cancel', expectedVersion: 0, workflowId: 'workflow-1', workItemId: 'item-1' })); await new Promise((resolve) => setTimeout(resolve, 0)); const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.endsWith('/engagements/engagement-1')); expect(requests).toHaveLength(3) })
  it('sends enrollment mutations through the BFF and refreshes only its immutable firm/template tag', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(engagementsApi.endpoints.getTemplateEnrollments.initiate({ firm: firmA, templateId: 'template-1' })),
      store.dispatch(engagementsApi.endpoints.getTemplateEnrollments.initiate({ firm: firmB, templateId: 'template-1' })),
    ])
    await store.dispatch(engagementsApi.endpoints.enrollTemplateClients.initiate({ firm: firmA, templateId: 'template-1', clientIds: ['client-1'] }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.endsWith('/engagements/templates/template-1/enrollments'))
    expect(requests).toHaveLength(4)
    expect(requests[2].method).toBe('POST')
    expect(await requests[2].json()).toEqual({ clientIds: ['client-1'] })
  })
  it('refreshes only the initiating firm’s engagement checklist after an optimistic-versioned toggle', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(engagementsApi.endpoints.getEngagementChecklist.initiate({ firm: firmA, engagementId: 'engagement-1' })),
      store.dispatch(engagementsApi.endpoints.getEngagementChecklist.initiate({ firm: firmB, engagementId: 'engagement-1' })),
    ])
    await store.dispatch(engagementsApi.endpoints.toggleEngagementChecklistItem.initiate({ firm: firmA, engagementId: 'engagement-1', checklistItemId: 'item-1', completed: true, expectedVersion: 2 }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.endsWith('/engagements/engagement-1/checklist'))
    expect(requests).toHaveLength(3)
    const mutation = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).find((request) => request.url.endsWith('/engagements/engagement-1/checklist/item-1'))
    expect(mutation?.method).toBe('PATCH')
    expect(await mutation?.json()).toEqual({ completed: true, expectedVersion: 2 })
  })
})
