import { InvitationAcceptanceForm } from '@/features/access/InvitationAcceptanceForm'

export default async function InvitationPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params
  return <InvitationAcceptanceForm token={token} />
}
