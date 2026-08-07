import { NextResponse } from 'next/server'

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

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!isAllowedMutationOrigin(request)) return jsonError(403, 'Cross-origin mutations are not allowed')

  const { token } = await context.params
  const upstream = await fetch(new URL(`/api/access/password-resets/${encodeURIComponent(token)}/complete`,
    serverEnvironment().FORGEBOARD_API_BASE_URL).toString(), {
    method: 'POST',
    headers: safeUpstreamHeaders(request),
    body: await request.arrayBuffer(),
    cache: 'no-store',
  })
  return safeResponse(upstream)
}
