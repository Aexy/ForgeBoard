import 'server-only'

import type { ServerApiSession } from './contracts'

export type { ServerApiSession } from './contracts'

export interface ServerApiRequest {
  path: string
  method?: string
  firmId?: string
  body?: BodyInit | null
  headers?: HeadersInit
  signal?: AbortSignal
}

export interface ServerApiTransport {
  request<T>(request: ServerApiRequest): Promise<T>
  response(request: ServerApiRequest): Promise<Response>
}

function apiBaseUrl(): string {
  const value = process.env.FORGEBOARD_API_BASE_URL
  if (!value) throw new Error('FORGEBOARD_API_BASE_URL must be configured')
  return value.endsWith('/') ? value : `${value}/`
}

function backendApiUrl(path: string): URL {
  const baseUrl = new URL(apiBaseUrl())
  const target = new URL(path, baseUrl)

  if (target.origin !== baseUrl.origin) {
    throw new Error('ForgeBoard API path must target the configured backend origin')
  }
  if (target.pathname !== '/api' && !target.pathname.startsWith('/api/')) {
    throw new Error('ForgeBoard API path must be a relative /api path')
  }

  return target
}

export function serverApi(session: ServerApiSession): ServerApiTransport {
  async function response(request: ServerApiRequest): Promise<Response> {
    // Validate the destination before constructing credential-bearing headers.
    const target = backendApiUrl(request.path)
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${session.accessToken}`)
    headers.set('Accept', 'application/json')
    if (request.firmId) headers.set('X-ForgeBoard-Firm', request.firmId)

    return fetch(target, {
      method: request.method ?? 'GET',
      headers,
      body: request.body,
      signal: request.signal,
      cache: 'no-store',
    })
  }

  return {
    response,
    async request<T>(request: ServerApiRequest) {
      const result = await response(request)
      if (!result.ok) throw new Error(`ForgeBoard API request failed with ${result.status}`)
      return result.json() as Promise<T>
    },
  }
}
