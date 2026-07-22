import { describe, expect, it } from 'vitest'

import { canonicalBoardQuery } from '@/lib/workflow-route-query'

describe('legacy workflow board query canonicalization', () => {
  const legacyTaskId = '123e4567-e89b-42d3-a456-426614174000'

  it('replaces an authorized UUID task query with its public task reference while preserving filters', () => {
    expect(canonicalBoardQuery({ priority: 'URGENT', task: legacyTaskId }, 'FB-1042').toString())
      .toBe('priority=URGENT&task=FB-1042')
  })

  it('drops an unresolved UUID task query rather than leaking it into the canonical URL', () => {
    expect(canonicalBoardQuery({ priority: 'URGENT', task: legacyTaskId }).toString())
      .toBe('priority=URGENT')
  })

  it('keeps only supported scalar board state in a canonical URL', () => {
    expect(canonicalBoardQuery({ priority: 'URGENT', injected: 'ignore-me', task: ['FB-1', 'FB-2'] }).toString())
      .toBe('priority=URGENT')
  })

  it('drops repeated task values even when one is a raw UUID', () => {
    expect(canonicalBoardQuery({ priority: 'URGENT', task: [legacyTaskId, 'FB-1042'] }).toString())
      .toBe('priority=URGENT')
  })
})
