import { notFound, redirect } from 'next/navigation'

import { auth } from '@/auth'

export default async function PlatformAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  if (!session?.user?.id || session.error === 'RefreshAccessTokenError') redirect('/sign-in')
  if (session.platformAdministrator !== true) notFound()

  return <section aria-label="Platform administration">{children}</section>
}
