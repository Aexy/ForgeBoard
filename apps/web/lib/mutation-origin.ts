import 'server-only'

import { serverEnvironment } from '@/lib/env'

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isAllowedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    const originUrl = new URL(origin)
    if (originUrl.origin === new URL(serverEnvironment().FORGEBOARD_PUBLIC_ORIGIN).origin) return true
    if (process.env.NODE_ENV === 'production') return false

    return originUrl.origin === new URL(request.url).origin && loopbackHosts.has(originUrl.hostname)
  } catch {
    return false
  }
}
