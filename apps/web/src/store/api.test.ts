// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { Provider } from 'react-redux'
import { render, waitFor } from '@testing-library/react'

import { forgeboardApi } from '@/store/api'
import { FirmCacheBoundary } from '@/store/firm-cache-boundary'
import { makeStore } from '@/store/store'

const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }

describe('ForgeBoard RTK Query tenant cache', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'workflow-1' }), {
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  it('invalidates only the mutated firm workflow tag', async () => {
    const store = makeStore()
    const first = store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmA, workflowSlug: 'monthly-close' }))
    const second = store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmB, workflowSlug: 'monthly-close' }))
    await Promise.all([first, second])

    await store.dispatch(forgeboardApi.endpoints.updateWorkflow.initiate({
      firm: firmA,
      workflowId: 'workflow-1',
      body: { name: 'Updated workflow' },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requestedUrls = vi.mocked(fetch).mock.calls.map(([input]) => (input as Request).url)
    expect(requestedUrls.filter((url) => url.includes('workflows/public/monthly-close') || url.includes('workflows/workflow-1'))).toHaveLength(4)
    expect(vi.mocked(fetch).mock.calls[3][0]).toEqual(expect.any(Request))
    const refreshedRequest = vi.mocked(fetch).mock.calls[3][0] as Request
    expect(refreshedRequest.headers.get('x-forgeboard-firm-slug')).toBeNull()
  })

  it('clears tenant-owned cache entries when the immutable firm context changes', async () => {
    const store = makeStore()
    await store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmA, workflowSlug: 'monthly-close' }))
    expect(Object.keys(store.getState().forgeboardApi.queries)).not.toHaveLength(0)

    const firmTree = (firmId: string) => createElement(Provider, {
      store,
      children: createElement(FirmCacheBoundary, {
        firmId,
        children: createElement('span', null, 'firm content'),
      }),
    })
    const view = render(
      firmTree(firmA.firmId),
    )
    view.rerender(
      firmTree(firmB.firmId),
    )

    await waitFor(() => expect(Object.keys(store.getState().forgeboardApi.queries)).toHaveLength(0))
  })

  it('sends an inclusive audit-trail end date with nanosecond precision', async () => {
    const store = makeStore()
    await store.dispatch(forgeboardApi.endpoints.getAuditTrail.initiate({
      firm: firmA,
      filters: { from: '2026-07-01', to: '2026-07-31' },
      size: 50,
    }))

    const request = vi.mocked(fetch).mock.calls[0][0] as Request
    expect(new URL(request.url).searchParams.get('to')).toBe('2026-07-31T23:59:59.999999999Z')
  })

  it('posts employee provisioning through the same-origin BFF and refreshes only that firm directory', async () => {
    const store = makeStore()
    await store.dispatch(forgeboardApi.endpoints.getEmployees.initiate({ firm: firmA }))
    await store.dispatch(forgeboardApi.endpoints.getEmployees.initiate({ firm: firmB }))
    await store.dispatch(forgeboardApi.endpoints.createEmployee.initiate({
      firm: firmA,
      employee: { displayName: 'Mira Miller', email: 'mira@example.com', temporaryPassword: 'temporary-password', role: 'MEMBER' },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request)
    const post = requests.find((request) => request.method === 'POST')
    expect(post?.url).toContain('/api/forgeboard/identity/employees')
    expect(await post?.json()).toEqual(expect.objectContaining({ email: 'mira@example.com', role: 'MEMBER' }))
    expect(requests.filter((request) => request.url.includes('identity/employees'))).toHaveLength(4)
  })

  it('posts workflows through the BFF and refreshes only that firm workflow list', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(forgeboardApi.endpoints.getWorkflows.initiate({ firm: firmA })),
      store.dispatch(forgeboardApi.endpoints.getWorkflows.initiate({ firm: firmB })),
    ])
    await store.dispatch(forgeboardApi.endpoints.createWorkflow.initiate({
      firm: firmA,
      details: { name: 'Monthly close', stages: [{ name: 'Waiting on client', attention: 'NONE' }, { name: 'In preparation', attention: 'NONE' }] },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request)
    const post = requests.find((request) => request.method === 'POST')
    expect(post?.url).toContain('/api/forgeboard/workflows')
    expect(await post?.json()).toEqual(expect.objectContaining({ name: 'Monthly close' }))
    expect(requests.filter((request) => request.url.endsWith('/api/forgeboard/workflows'))).toHaveLength(4)
  })

  it('refreshes only the generated engagement workflow board', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request
      const engagement = request.url.includes('/instances')
      return new Response(JSON.stringify(engagement ? { id: 'engagement-1', workflowId: 'workflow-1' } : { id: 'workflow-1' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }))
    const store = makeStore()
    await Promise.all([
      store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmA, workflowSlug: 'monthly-close' })),
      store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmB, workflowSlug: 'monthly-close' })),
    ])
    await store.dispatch(forgeboardApi.endpoints.createEngagement.initiate({
      firm: firmA,
      templateId: 'template-1',
      details: { clientId: 'client-1', periodStart: '2026-07-01' },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const workflowRequests = vi.mocked(fetch).mock.calls
      .map(([input]) => input as Request)
      .filter((request) => request.url.includes('workflows/public/monthly-close'))
    expect(workflowRequests).toHaveLength(3)
  })

  it('refreshes linked task details only in the firm receiving a document request', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(forgeboardApi.endpoints.getWorkItemDetail.initiate({ firm: firmA, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })),
      store.dispatch(forgeboardApi.endpoints.getWorkItemDetail.initiate({ firm: firmB, workflowSlug: 'monthly-close', taskReference: 'FB-1042' })),
    ])
    await store.dispatch(forgeboardApi.endpoints.receiveDocumentRequest.initiate({ firm: firmA, requestId: 'request-1' }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const detailRequests = vi.mocked(fetch).mock.calls
      .map(([input]) => input as Request)
      .filter((request) => request.url.includes('workflows/public/monthly-close/items/FB-1042'))
    expect(detailRequests).toHaveLength(3)
  })
})
