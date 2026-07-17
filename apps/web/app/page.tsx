import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { isPreviewFirmEnabled } from '@/lib/preview-rollout'

import { AccessScreen } from './(auth)/AccessScreen'

export default async function HomePage({ searchParams }: Readonly<{ searchParams: Promise<{ callbackUrl?: string }> }>) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const callbackUrl = params.callbackUrl?.startsWith('/firms/') && !params.callbackUrl.startsWith('//') ? params.callbackUrl : undefined
  const firm = session?.firms.find((candidate) => isPreviewFirmEnabled(candidate.slug))
  if (session?.user?.id && session.error !== 'RefreshAccessTokenError') redirect(callbackUrl ?? (firm ? `/firms/${firm.slug}/my-work` : '/preview-unavailable'))
  return <AccessScreen callbackUrl={callbackUrl} />
}
