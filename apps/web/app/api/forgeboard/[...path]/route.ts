import { NextResponse } from 'next/server'

import { authorizedFirmRoute } from '@/lib/authorized-firm-route'
import { firmContextCookieBinding } from '@/lib/firm-context-cookie'
import { isAllowedMutationOrigin } from '@/lib/mutation-origin'
import { isPreviewFirmEnabled } from '@/lib/preview-rollout'

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
  return `/api/${encodedPath}${new URL(request.url).search}`
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

  const authentication = await authorizedFirmRoute(request, '')
  if (authentication.kind === 'authentication-required') return jsonError(401, 'Authentication is required')

  const cookieBinding = await firmContextCookieBinding(request.headers.get('cookie'))
  if (!cookieBinding) return jsonError(404, 'Firm not found')

  // A signed cookie is still checked against current session membership. This
  // prevents cookie replay after a membership/firm-list change and ensures a
  // browser header never controls the backend tenant identity.
  const result = await authorizedFirmRoute(request, cookieBinding.firm.firmSlug, cookieBinding.userId)
  if (result.kind === 'authentication-required') return jsonError(401, 'Authentication is required')
  if (result.kind === 'firm-not-found' || result.route.firm.firmId !== cookieBinding.firm.firmId) return jsonError(404, 'Firm not found')
  const { firm, api } = result.route
  if (!isPreviewFirmEnabled(firm.firmSlug)) return jsonError(403, 'This firm is not enabled for the preview')

  const { path } = await context.params
  if (path.length === 0) return jsonError(404, 'API resource not found')

  const body = UNSAFE_METHODS.has(request.method) ? await request.arrayBuffer() : undefined
  const upstream = await api.response({
    path: upstreamPath(path, request),
    method: request.method,
    firmId: firm.firmId,
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
