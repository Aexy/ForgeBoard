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
})
