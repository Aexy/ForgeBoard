import 'server-only'

import type { FirmContext } from '@/lib/firm-context'
import { serverEnvironment } from '@/lib/env'

export const FIRM_CONTEXT_COOKIE = 'forgeboard-firm-context'

interface SignedFirmContext {
  version: 1
  userId: string
  firmId: string
  firmSlug: string
}

export interface FirmContextCookieBinding {
  userId: string
  firm: FirmContext
}

const encoder = new TextEncoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlToBytes(value: string): Uint8Array | undefined {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
    const binary = atob(base64)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return undefined
  }
}

async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(serverEnvironment().AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function signature(value: string): Promise<string> {
  const signed = await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(value))
  return bytesToBase64Url(new Uint8Array(signed))
}

/**
 * The browser cannot choose a backend firm identifier. It may only select a
 * session-authorized slug once, through the context route, which records this
 * signed and HttpOnly binding for later BFF calls.
 */
export async function createFirmContextValue(userId: string, firm: FirmContext): Promise<string> {
  const payload: SignedFirmContext = {
    version: 1,
    userId,
    firmId: firm.firmId,
    firmSlug: firm.firmSlug,
  }
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  return `${encodedPayload}.${await signature(encodedPayload)}`
}

export async function firmContextCookieBinding(cookieHeader: string | null): Promise<FirmContextCookieBinding | undefined> {
  const value = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${FIRM_CONTEXT_COOKIE}=`))
    ?.slice(FIRM_CONTEXT_COOKIE.length + 1)
  if (!value) return undefined

  const [encodedPayload, providedSignature, ...remainder] = value.split('.')
  if (!encodedPayload || !providedSignature || remainder.length > 0) return undefined

  const provided = base64UrlToBytes(providedSignature)
  if (!provided || !await crypto.subtle.verify('HMAC', await signingKey(), provided, encoder.encode(encodedPayload))) return undefined

  try {
    const payloadBytes = base64UrlToBytes(encodedPayload)
    if (!payloadBytes) return undefined
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<SignedFirmContext>
    if (payload.version !== 1 || typeof payload.userId !== 'string'
      || typeof payload.firmId !== 'string' || typeof payload.firmSlug !== 'string') return undefined
    return { userId: payload.userId, firm: { firmId: payload.firmId, firmSlug: payload.firmSlug, role: 'MEMBER' } }
  } catch {
    return undefined
  }
}

export async function firmContextFromCookie(cookieHeader: string | null, userId: string): Promise<FirmContext | undefined> {
  const binding = await firmContextCookieBinding(cookieHeader)
  return binding?.userId === userId ? binding.firm : undefined
}
