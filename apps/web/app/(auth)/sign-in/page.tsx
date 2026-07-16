import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { isPreviewFirmEnabled } from '@/lib/preview-rollout'

import { SignInForm } from './SignInForm'

function safeCallbackUrl(value: string | undefined): string | undefined {
  return value?.startsWith('/') && !value.startsWith('//') ? value : undefined
}

export default async function SignInPage({ searchParams }: Readonly<{ searchParams: Promise<{ callbackUrl?: string }> }>) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const callbackUrl = safeCallbackUrl(params.callbackUrl)
  const firstPreviewFirm = session?.firms.find((firm) => isPreviewFirmEnabled(firm.slug))
  if (session?.user?.id) redirect(callbackUrl ?? (firstPreviewFirm ? `/firms/${firstPreviewFirm.slug}/my-work` : '/preview-unavailable'))
  return (
    <main>
      <h1>Sign in to ForgeBoard</h1>
      <p>Pick up where your accounting team left off.</p>
      <SignInForm callbackUrl={callbackUrl} />
    </main>
  )
}
