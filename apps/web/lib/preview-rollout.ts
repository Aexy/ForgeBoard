import { serverEnvironment, type ServerEnvironment } from '@/lib/env'

const firmSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function previewFirmSlugs(environment: Pick<ServerEnvironment, 'FORGEBOARD_PREVIEW_FIRM_SLUGS'>): ReadonlySet<string> | undefined {
  const configured = environment.FORGEBOARD_PREVIEW_FIRM_SLUGS
  if (!configured) return undefined

  const slugs = configured.split(',').map((slug) => slug.trim())
  if (slugs.some((slug) => !firmSlugPattern.test(slug))) {
    throw new Error('FORGEBOARD_PREVIEW_FIRM_SLUGS must be a comma-separated list of firm slugs')
  }
  return new Set(slugs)
}

export function isPreviewFirmEnabled(firmSlug: string, environment = serverEnvironment()): boolean {
  const allowedSlugs = previewFirmSlugs(environment)
  return allowedSlugs === undefined || allowedSlugs.has(firmSlug)
}
