import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { isPreviewFirmEnabled } from '@/lib/preview-rollout'

export default async function SignInPage({ searchParams }: Readonly<{ searchParams: Promise<{ callbackUrl?: string }> }>) {
  const { callbackUrl } = await searchParams
  const safeCallbackUrl = callbackUrl?.startsWith('/firms/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined
  const session = await auth()
  const firm = session?.firms.find((candidate) => isPreviewFirmEnabled(candidate.slug))
  if (session?.user?.id && session.error !== 'RefreshAccessTokenError') redirect(safeCallbackUrl ?? (firm ? `/firms/${firm.slug}/my-work` : '/preview-unavailable'))
  redirect(safeCallbackUrl ? `/?callbackUrl=${encodeURIComponent(safeCallbackUrl)}` : '/')
}
