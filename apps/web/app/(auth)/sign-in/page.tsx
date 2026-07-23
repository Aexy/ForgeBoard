import { redirect } from 'next/navigation'

import { auth } from '@/auth'

export default async function SignInPage({ searchParams }: Readonly<{ searchParams: Promise<{ callbackUrl?: string }> }>) {
  const { callbackUrl } = await searchParams
  const safeCallbackUrl = callbackUrl?.startsWith('/firms/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined
  const session = await auth()
  const firm = session?.firms[0]
  if (session?.user?.id && session.error !== 'RefreshAccessTokenError') {
    redirect(session.platformAdministrator ? '/platform-admin' : safeCallbackUrl ?? (firm ? `/firms/${firm.slug}/my-work` : '/'))
  }
  redirect(safeCallbackUrl ? `/?callbackUrl=${encodeURIComponent(safeCallbackUrl)}` : '/')
}
