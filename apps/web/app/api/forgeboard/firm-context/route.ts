import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { createFirmContextValue, FIRM_CONTEXT_COOKIE } from '@/lib/firm-context-cookie'
import { firmContextForSlug } from '@/lib/firm-context'
import { serverEnvironment } from '@/lib/env'
import { isAllowedMutationOrigin } from '@/lib/mutation-origin'
import { isPreviewFirmEnabled } from '@/lib/preview-rollout'

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAllowedMutationOrigin(request)) return NextResponse.json({ error: 'Cross-origin mutations are not allowed' }, { status: 403 })

  const session = await auth()
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') {
    return NextResponse.json({ error: 'Authentication is required' }, { status: 401 })
  }

  const body = await request.json().catch(() => undefined) as { firmSlug?: unknown } | undefined
  const firm = firmContextForSlug(session, typeof body?.firmSlug === 'string' ? body.firmSlug : null)
  if (!firm) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
  if (!isPreviewFirmEnabled(firm.firmSlug)) return NextResponse.json({ error: 'This firm is not enabled for the preview' }, { status: 403 })

  const response = NextResponse.json({ firmSlug: firm.firmSlug })
  response.cookies.set({
    name: FIRM_CONTEXT_COOKIE,
    value: await createFirmContextValue(session.user.id, firm),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/forgeboard',
  })
  return response
}
