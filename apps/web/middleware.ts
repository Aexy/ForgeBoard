import { NextResponse, type NextRequest } from 'next/server'

import { auth } from '@/auth'
import { createFirmContextValue, firmContextFromCookie, FIRM_CONTEXT_COOKIE } from '@/lib/firm-context-cookie'
import { firmContextForSlug } from '@/lib/firm-context'

function signInRedirect(request: NextRequest): NextResponse {
  const target = new URL('/sign-in', request.url)
  target.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(target)
}

export default auth(async (request) => {
  const session = request.auth
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') return signInRedirect(request)

  const firmSlug = request.nextUrl.pathname.split('/')[2] ?? null
  const firm = firmContextForSlug(session, firmSlug)
  if (!firm) return NextResponse.rewrite(new URL('/not-found', request.url))

  const currentFirm = await firmContextFromCookie(request.headers.get('cookie'), session.user.id)
  if (currentFirm?.firmId === firm.firmId && currentFirm.firmSlug === firm.firmSlug) return NextResponse.next()

  const response = NextResponse.next()
  response.cookies.set({
    name: FIRM_CONTEXT_COOKIE,
    value: await createFirmContextValue(session.user.id, firm),
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/forgeboard',
  })
  return response
})

export const config = {
  matcher: ['/firms/:path*'],
}
