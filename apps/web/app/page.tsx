import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { HomeHero } from '@/features/public-site/HomeHero'

import { AccessScreen } from './(auth)/AccessScreen'

export const metadata: Metadata = {
  title: 'ForgeBoard | Accounting workflow software',
  description: 'Run recurring client work with clear ownership, review handoffs, and deadline visibility.',
}

export default async function HomePage({ searchParams }: Readonly<{ searchParams: Promise<{ callbackUrl?: string }> }>) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const callbackUrl = params.callbackUrl?.startsWith('/firms/') && !params.callbackUrl.startsWith('//') ? params.callbackUrl : undefined
  const firm = session?.firms[0]
  if (session?.user?.id && session.error !== 'RefreshAccessTokenError') {
    if (session.platformAdministrator || callbackUrl || firm) {
      redirect(session.platformAdministrator ? '/platform-admin' : callbackUrl ?? `/firms/${firm!.slug}/my-work`)
    }
    return <AccessScreen callbackUrl={callbackUrl} />
  }
  return <HomeHero />
}
