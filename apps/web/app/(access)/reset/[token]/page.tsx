import { PasswordResetForm } from '@/features/access/PasswordResetForm'

export default async function ResetPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params
  return <PasswordResetForm token={token} />
}
