// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getWorkflowBoard, moveWorkItem } from '@/features/workflow/workflow-transport'
import { myWorkApi } from '@/features/my-work/my-work-transport'
import { makeStore } from '@/store/store'

const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }

describe('workflow transport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'workflow-1' }), {
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  it('moves a work item through the BFF and refreshes only the mutated firm board and My Work', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(getWorkflowBoard.initiate({ firm: firmA, workflowSlug: 'monthly-close' })),
      store.dispatch(getWorkflowBoard.initiate({ firm: firmB, workflowSlug: 'monthly-close' })),
      store.dispatch(myWorkApi.endpoints.getMyWork.initiate({ firm: firmA })),
      store.dispatch(myWorkApi.endpoints.getMyWork.initiate({ firm: firmB })),
    ])

    await store.dispatch(moveWorkItem.initiate({
      firm: firmA,
      workflowId: 'workflow-1',
      itemId: 'work-item-1',
      targetStageId: 'preparation',
      expectedVersion: 4,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request)
    const moveRequest = requests.find((request) => request.method === 'PATCH')
    expect(moveRequest?.url).toContain('/api/forgeboard/workflows/workflow-1/items/work-item-1/position')
    expect(requests.filter((request) => request.url.includes('workflows/public/monthly-close'))).toHaveLength(3)
    expect(requests.filter((request) => request.url.includes('dashboard/my-work'))).toHaveLength(3)
  })
})
