import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@forgeboard/ui'

import { auth } from '@/auth'

import { PlatformNavigation } from './PlatformNavigation'

export default async function PlatformAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') redirect('/sign-in')
  if (session.platformAdministrator !== true) notFound()

  return <AppShell navigation={<PlatformNavigation userEmail={session.user.email ?? 'Platform administrator'} />}><section aria-label="Platform administration">{children}</section></AppShell>
}
