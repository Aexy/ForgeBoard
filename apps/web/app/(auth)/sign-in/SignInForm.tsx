'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../LanguageProvider'
import styles from './SignInForm.module.css'

export function SignInForm({ callbackUrl, className }: Readonly<{ callbackUrl?: string; className?: string }>) {
  const router = useRouter()
  const { t } = useLanguage()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const result = await signIn('credentials', { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? ''), redirect: false, callbackUrl: callbackUrl ?? '/' })
    if (result?.error) { setError(t('access.signInFailed')); setBusy(false); return }
    const destination = callbackUrl
      ? `/?callbackUrl=${encodeURIComponent(callbackUrl)}&postSignIn=1`
      : '/?postSignIn=1'
    router.replace(destination)
    router.refresh()
  }
  return <form className={className ?? styles.form} onSubmit={submit}><label>{t('access.emailAddress')}<input name="email" type="email" autoComplete="email" required /></label><label>{t('access.password')}<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? t('access.signingIn') : t('access.signIn')}</button></form>
}
