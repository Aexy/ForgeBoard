// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { firmCalendarApi } from './firm-calendar-transport'
import { makeStore } from '@/store/store'

const firmA = { firmId: 'firm-a', firmSlug: 'hearth', role: 'OWNER' as const }
const firmB = { firmId: 'firm-b', firmSlug: 'northstar', role: 'OWNER' as const }

describe('firm calendar transport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ timeZone: 'Europe/Vienna', statutoryHolidays: [], closures: [] }), { headers: { 'Content-Type': 'application/json' } })))
  })

  it('keeps cached calendar years firm-scoped and sends closure mutations through the BFF', async () => {
    const store = makeStore()
    await Promise.all([
      store.dispatch(firmCalendarApi.endpoints.getFirmCalendar.initiate({ firm: firmA, year: 2026 })),
      store.dispatch(firmCalendarApi.endpoints.getFirmCalendar.initiate({ firm: firmB, year: 2026 })),
    ])
    await store.dispatch(firmCalendarApi.endpoints.createFirmClosure.initiate({ firm: firmA, year: 2026, closure: { closureDate: '2026-12-24', label: 'Year-end closure' } }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const requests = vi.mocked(fetch).mock.calls.map(([input]) => input as Request).filter((request) => request.url.includes('firm-calendar'))
    expect(requests).toHaveLength(4)
    expect(requests[2].method).toBe('POST')
    expect(await requests[2].json()).toEqual({ closureDate: '2026-12-24', label: 'Year-end closure' })
  })
})
