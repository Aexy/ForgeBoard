import { describe, expect, it } from 'vitest'

import { serverEnvironment } from '@/lib/env'
import { isPreviewFirmEnabled, previewFirmSlugs } from '@/lib/preview-rollout'

const baseEnvironment = {
  AUTH_SECRET: 'test-secret-with-sufficient-length',
  AUTH_URL: 'https://preview.example.test',
  FORGEBOARD_API_BASE_URL: 'http://spring:8080',
  FORGEBOARD_TOKEN_ISSUER: 'forgeboard',
  FORGEBOARD_PUBLIC_ORIGIN: 'https://preview.example.test',
}

describe('Next preview rollout', () => {
  it('requires an explicit firm allow-list in production', () => {
    expect(() => serverEnvironment({ ...baseEnvironment, NODE_ENV: 'production' })).toThrow('FORGEBOARD_PREVIEW_FIRM_SLUGS')
  })

  it('restricts production preview access to configured firm slugs', () => {
    const environment = serverEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'production',
      FORGEBOARD_PREVIEW_FIRM_SLUGS: 'hearth-accounting, northstar',
    })

    expect(previewFirmSlugs(environment)).toEqual(new Set(['hearth-accounting', 'northstar']))
    expect(isPreviewFirmEnabled('hearth-accounting', environment)).toBe(true)
    expect(isPreviewFirmEnabled('other-firm', environment)).toBe(false)
  })

  it('rejects malformed rollout configuration rather than enabling an unintended firm', () => {
    expect(() => previewFirmSlugs({ FORGEBOARD_PREVIEW_FIRM_SLUGS: 'hearth, OTHER' })).toThrow('comma-separated list of firm slugs')
  })
})
