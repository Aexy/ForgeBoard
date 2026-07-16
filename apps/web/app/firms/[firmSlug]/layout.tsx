import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@forgeboard/ui'

import { auth } from '@/auth'
import { firmContextForSlug } from '@/lib/firm-context'
import { isPreviewFirmEnabled } from '@/lib/preview-rollout'
import { FirmCacheBoundary, FirmContextProvider } from '@/store/firm-cache-boundary'

import { FirmNavigation } from './FirmNavigation'

export default async function FirmLayout({ children, params }: Readonly<{
  children: React.ReactNode
  params: Promise<{ firmSlug: string }>
}>) {
  const [session, { firmSlug }] = await Promise.all([auth(), params])
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') redirect('/sign-in')

  const firm = firmContextForSlug(session, firmSlug)
  if (!firm) notFound()
  if (!isPreviewFirmEnabled(firm.firmSlug)) redirect('/preview-unavailable')

  return (
    <FirmCacheBoundary firmId={firm.firmId}>
      <FirmContextProvider firm={firm}>
        <AppShell navigation={<FirmNavigation firm={firm} />}>
          <section data-firm-id={firm.firmId} data-firm-slug={firm.firmSlug} data-firm-role={firm.role}>
            {children}
          </section>
        </AppShell>
      </FirmContextProvider>
    </FirmCacheBoundary>
  )
}
