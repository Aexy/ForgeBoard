import { NextResponse } from 'next/server'
import { serverApi } from '@forgeboard/api-client/server'

import { auth } from '@/auth'
import { apiSessionFromRequest } from '@/lib/auth-session'
import { serverEnvironment } from '@/lib/env'
import { isAllowedMutationOrigin } from '@/lib/mutation-origin'

const SAFE_RESPONSE_HEADERS = ['content-type', 'x-correlation-id', 'x-request-id'] as const
type RouteContext = { params: Promise<{ token: string }> }

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status })
}

function safeUpstreamHeaders(request: Request): Headers {
  const headers = new Headers({ Accept: 'application/json' })
  const contentType = request.headers.get('content-type')
  const correlationId = request.headers.get('x-correlation-id') ?? request.headers.get('x-request-id')
  if (contentType) headers.set('Content-Type', contentType)
  if (correlationId) headers.set('X-Correlation-Id', correlationId)
  return headers
}

async function safeResponse(upstream: Response): Promise<NextResponse> {
  const headers = new Headers()
  for (const name of SAFE_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8')
  if (upstream.status === 204 || upstream.status === 304) return new NextResponse(null, { status: upstream.status, headers })
  return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers })
}

function accessUrl(path: string): string {
  return new URL(path, serverEnvironment().FORGEBOARD_API_BASE_URL).toString()
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isAllowedMutationOrigin(request)) return jsonError(403, 'Cross-origin mutations are not allowed')

  const { token } = await context.params
  const upstream = await fetch(accessUrl(`/api/access/invitations/${encodeURIComponent(token)}/accept-new`), {
    method: 'POST',
    headers: safeUpstreamHeaders(request),
    body: await request.arrayBuffer(),
    cache: 'no-store',
  })
  return safeResponse(upstream)
}

/** Accepts an existing account after Auth.js has established a bearer-backed session. */
export async function PUT(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isAllowedMutationOrigin(request)) return jsonError(403, 'Cross-origin mutations are not allowed')

  const session = await auth()
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') {
    return jsonError(401, 'Authentication is required')
  }
  const apiSession = await apiSessionFromRequest(request, session)
  if (!apiSession) return jsonError(401, 'Authentication is required')

  const { token } = await context.params
  const upstream = await serverApi(apiSession).response({
    path: `/api/access/invitations/${encodeURIComponent(token)}/accept-existing`,
    method: 'POST',
    headers: safeUpstreamHeaders(request),
    body: await request.arrayBuffer(),
  })
  return safeResponse(upstream)
}
