'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styles from './SignInForm.module.css'

export function SignInForm({ callbackUrl, className }: Readonly<{ callbackUrl?: string; className?: string }>) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const result = await signIn('credentials', { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? ''), redirect: false, callbackUrl: callbackUrl ?? '/' })
    if (result?.error) { setError('We could not sign you in. Check your details and try again.'); setBusy(false); return }
    router.push(result?.url && result.url.startsWith('/') ? result.url : callbackUrl ?? '/')
    router.refresh()
  }
  return <form className={className ?? styles.form} onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>
}
