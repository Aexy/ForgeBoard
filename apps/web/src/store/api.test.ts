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
    const first = store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmA, workflowId: 'workflow-1' }))
    const second = store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmB, workflowId: 'workflow-1' }))
    await Promise.all([first, second])

    await store.dispatch(forgeboardApi.endpoints.updateWorkflow.initiate({
      firm: firmA,
      workflowId: 'workflow-1',
      body: { name: 'Updated workflow' },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requestedUrls = vi.mocked(fetch).mock.calls.map(([input]) => (input as Request).url)
    expect(requestedUrls.filter((url) => url.includes('workflows/workflow-1'))).toHaveLength(4)
    expect(vi.mocked(fetch).mock.calls[3][0]).toEqual(expect.any(Request))
    const refreshedRequest = vi.mocked(fetch).mock.calls[3][0] as Request
    expect(refreshedRequest.headers.get('x-forgeboard-firm-slug')).toBeNull()
  })

  it('clears tenant-owned cache entries when the immutable firm context changes', async () => {
    const store = makeStore()
    await store.dispatch(forgeboardApi.endpoints.getWorkflowBoard.initiate({ firm: firmA, workflowId: 'workflow-1' }))
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
})
