import type { AccessibleFirm, BrowserSession } from '@forgeboard/api-client'

export interface FirmContext {
  firmId: string
  firmSlug: string
  role: AccessibleFirm['role']
}

export function firmContextForSlug(
  session: Pick<BrowserSession, 'firms'>,
  firmSlug: string | null,
): FirmContext | undefined {
  if (!firmSlug) return undefined
  const firm = session.firms.find((candidate) => candidate.slug === firmSlug)
  if (!firm) return undefined

  return { firmId: firm.id, firmSlug: firm.slug, role: firm.role }
}
