import { NextResponse } from 'next/server'

import { authorizedPlatformAdminRoute } from '@/lib/authorized-platform-admin-route'
import { isAllowedMutationOrigin } from '@/lib/mutation-origin'

const SAFE_RESPONSE_HEADERS = [
  'content-type',
  'link',
  'x-correlation-id',
  'x-page',
  'x-page-size',
  'x-request-id',
  'x-total-count',
  'x-total-pages',
] as const
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

type RouteContext = { params: Promise<{ path: string[] }> }

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status })
}

function upstreamPath(path: string[], request: Request): string {
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join('/')
  return `/api/platform-admin/${encodedPath}${new URL(request.url).search}`
}

function safeUpstreamHeaders(request: Request): Headers {
  const headers = new Headers({ Accept: 'application/json' })
  const contentType = request.headers.get('content-type')
  const correlationId = request.headers.get('x-correlation-id') ?? request.headers.get('x-request-id')
  if (contentType) headers.set('Content-Type', contentType)
  if (correlationId) headers.set('X-Correlation-Id', correlationId)
  return headers
}

async function proxy(request: Request, context: RouteContext): Promise<NextResponse> {
  if (UNSAFE_METHODS.has(request.method) && !isAllowedMutationOrigin(request)) return jsonError(403, 'Cross-origin mutations are not allowed')

  const { path } = await context.params
  if (path.length === 0) return jsonError(404, 'API resource not found')

  const result = await authorizedPlatformAdminRoute(request)
  if (result.kind === 'authentication-required') return jsonError(401, 'Authentication is required')
  if (result.kind === 'platform-admin-forbidden') return jsonError(403, 'Platform administrator access is required')

  const body = UNSAFE_METHODS.has(request.method) ? await request.arrayBuffer() : undefined
  const upstream = await result.route.api.response({
    path: upstreamPath(path, request),
    method: request.method,
    headers: safeUpstreamHeaders(request),
    body,
  })

  const headers = new Headers()
  for (const name of SAFE_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8')

  return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
