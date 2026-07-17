import { NextResponse } from 'next/server'

import { serverEnvironment } from '@/lib/env'

type OnboardingDetails = { firmName: string; firmSlug: string; ownerName: string; ownerEmail: string; password: string }
type SafeOnboardingResult = { firmId: string; firmSlug: string }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validatedDetails(value: unknown): OnboardingDetails | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  const firmName = typeof candidate.firmName === 'string' ? candidate.firmName.trim() : ''
  const firmSlug = typeof candidate.firmSlug === 'string' ? candidate.firmSlug.trim() : ''
  const ownerName = typeof candidate.ownerName === 'string' ? candidate.ownerName.trim() : ''
  const ownerEmail = typeof candidate.ownerEmail === 'string' ? candidate.ownerEmail.trim() : ''
  const password = typeof candidate.password === 'string' ? candidate.password : ''
  if (!firmName || firmName.length > 160 || !slugPattern.test(firmSlug) || firmSlug.length > 80 || !ownerName || ownerName.length > 160 || !emailPattern.test(ownerEmail) || ownerEmail.length > 320 || password.length < 12 || password.length > 128) return undefined
  return { firmName, firmSlug, ownerName, ownerEmail, password }
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try { return new URL(origin).origin === new URL(serverEnvironment().FORGEBOARD_PUBLIC_ORIGIN).origin } catch { return false }
}

function safeResult(value: unknown): SafeOnboardingResult | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  return typeof candidate.firmId === 'string' && /^[0-9a-f-]{36}$/i.test(candidate.firmId) && typeof candidate.firmSlug === 'string' && slugPattern.test(candidate.firmSlug)
    ? { firmId: candidate.firmId, firmSlug: candidate.firmSlug }
    : undefined
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Cross-origin onboarding is not allowed.' }, { status: 403 })
  const details = validatedDetails(await request.json().catch(() => undefined))
  if (!details) return NextResponse.json({ error: 'The onboarding details are invalid.' }, { status: 400 })
  const upstream = await fetch(new URL('/api/onboarding/firms', serverEnvironment().FORGEBOARD_API_BASE_URL), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(details), cache: 'no-store' })
  const body = await upstream.json().catch(() => undefined)
  if (!upstream.ok) return NextResponse.json({ error: 'We could not create your firm. Review the details and try again.' }, { status: upstream.status })
  const result = safeResult(body)
  return result
    ? NextResponse.json(result, { status: upstream.status })
    : NextResponse.json({ error: 'The onboarding service returned an invalid response.' }, { status: 502 })
}
