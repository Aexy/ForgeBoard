import { redirect } from 'next/navigation'

import { auth } from '@/auth'

import { AccessScreen } from './(auth)/AccessScreen'

export default async function HomePage({ searchParams }: Readonly<{ searchParams: Promise<{ callbackUrl?: string }> }>) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const callbackUrl = params.callbackUrl?.startsWith('/firms/') && !params.callbackUrl.startsWith('//') ? params.callbackUrl : undefined
  const firm = session?.firms[0]
  if (session?.user?.id && session.error !== 'RefreshAccessTokenError') {
    if (callbackUrl || firm || session.platformAdministrator) {
      redirect(callbackUrl ?? (firm ? `/firms/${firm.slug}/my-work` : '/platform-admin'))
    }
  }
  return <AccessScreen callbackUrl={callbackUrl} />
}
