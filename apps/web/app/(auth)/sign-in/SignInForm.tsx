'use client'

import { FormEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../LanguageProvider'
import styles from './SignInForm.module.css'

export function SignInForm({ callbackUrl, className }: Readonly<{ callbackUrl?: string; className?: string }>) {
  const router = useRouter()
  const { t } = useLanguage()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const passwordId = useId()
  const submitting = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => { if (error) errorRef.current?.focus() }, [error])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const data = new FormData(event.currentTarget)
      const result = await signIn('credentials', { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? ''), remember: data.get('remember') === 'true', redirect: false, callbackUrl: callbackUrl ?? '/' })
      if (!result || result.error) throw new Error('Sign-in failed')
      const destination = callbackUrl
        ? `/?callbackUrl=${encodeURIComponent(callbackUrl)}&postSignIn=1`
        : '/?postSignIn=1'
      router.replace(destination)
      router.refresh()
    } catch {
      setError(t('access.signInFailed'))
      submitting.current = false
      setBusy(false)
    }
  }
  return <form className={className ?? styles.form} onSubmit={submit} aria-busy={busy}>
    <label>{t('access.emailAddress')}<input name="email" type="email" autoComplete="email" spellCheck={false} required /></label>
    <div className={styles.passwordField}>
      <label htmlFor={passwordId}>{t('access.password')}</label>
      <div className={styles.passwordRow}>
        <input id={passwordId} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
        <button className={styles.passwordToggle} type="button" aria-label={showPassword ? t('access.hidePassword') : t('access.showPassword')} aria-controls={passwordId} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
        </button>
      </div>
    </div>
    <label className={styles.remember}><input name="remember" type="checkbox" value="true" />{t('access.rememberMe')}</label>
    <p className={styles.recovery}>{t('access.passwordRecoveryGuidance')}</p>
    {error && <p ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    <button type="submit" disabled={busy}>{busy ? t('access.signingIn') : t('access.signIn')}</button>
  </form>
}
