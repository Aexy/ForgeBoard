import { describe, expect, it } from 'vitest'

import {
  boardPathWithoutTask,
  canonicalBoardQuery,
  filteredBoardPath,
  filtersFromSearch,
  isCanonicalBoardQuery,
  taskPanelPath,
  taskWorkspacePath,
} from '@/features/workflow/workflow-route-state'

const basePath = '/firms/hearth/workflow/monthly-close'
const legacyTaskId = '123e4567-e89b-42d3-a456-426614174000'

describe('workflow route state', () => {
  it('parses scalar filter state and treats only true as unassigned', () => {
    expect(filtersFromSearch(new URLSearchParams('client=client-1&owner=owner-1&due=soon&priority=URGENT&unassigned=true')))
      .toEqual({ client: 'client-1', owner: 'owner-1', due: 'soon', priority: 'URGENT', unassigned: true })
    expect(filtersFromSearch(new URLSearchParams('unassigned=1'))).toMatchObject({ unassigned: false })
  })

  it('drops unknown and repeated state while canonicalizing UUID task values', () => {
    expect(canonicalBoardQuery({ priority: 'URGENT', injected: 'ignore-me', task: [legacyTaskId, 'FB-1042'] }).toString())
      .toBe('priority=URGENT')
    expect(canonicalBoardQuery({ priority: 'URGENT', task: legacyTaskId }, 'FB-1042').toString())
      .toBe('priority=URGENT&task=FB-1042')
    expect(canonicalBoardQuery({ priority: 'URGENT', task: legacyTaskId }).toString()).toBe('priority=URGENT')
    expect(isCanonicalBoardQuery({ priority: 'URGENT', task: 'FB-1042' })).toBe(true)
    expect(isCanonicalBoardQuery({ priority: 'URGENT', injected: 'ignore-me', task: ['FB-1042', 'FB-1043'] })).toBe(false)
  })

  it('opens and closes task panels without losing filters', () => {
    const search = new URLSearchParams('priority=URGENT&due=soon&task=FB-1041')
    expect(taskPanelPath(basePath, search, 'FB-1042')).toBe(`${basePath}?priority=URGENT&due=soon&task=FB-1042`)
    expect(boardPathWithoutTask(basePath, search)).toBe(`${basePath}?priority=URGENT&due=soon`)
  })

  it('builds replace filter URLs and push task URLs with public task references', () => {
    const search = new URLSearchParams('priority=NORMAL&task=FB-1041&priority=URGENT&injected=value')
    expect(filteredBoardPath(basePath, search, { priority: 'URGENT', unassigned: true }))
      .toBe(`${basePath}?priority=URGENT&unassigned=true`)
    expect(taskWorkspacePath(basePath, 'FB-1042')).toBe(`${basePath}/tasks/FB-1042`)
  })
})
