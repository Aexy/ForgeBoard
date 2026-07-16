import Link from 'next/link'

export default function FirmNotFound() {
  return (
    <main>
      <h1>Firm not found</h1>
      <p>You do not have access to this firm workspace.</p>
      <Link href="/sign-in">Sign in with another account</Link>
    </main>
  )
}
