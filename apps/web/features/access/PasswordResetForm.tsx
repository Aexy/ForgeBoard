'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { useLanguage } from '@/app/LanguageProvider'
import styles from './AccessActionForm.module.css'

export function PasswordResetForm({ token }: Readonly<{ token: string }>) {
  const { t } = useLanguage()
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const alert = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (error) alert.current?.focus() }, [error])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    if (!password || !String(data.get('passwordConfirmation') ?? '')) { setError(t('access.requiredFields')); return }
    if (password.length < 12) { setError(t('access.passwordTooShort')); return }
    if (password !== String(data.get('passwordConfirmation') ?? '')) { setError(t('access.passwordMismatch')); return }
    submitting.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/forgeboard/access/password-resets/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!response.ok) throw new Error('Password reset failed')
      await signOut({ redirect: false })
      router.replace('/sign-in')
      router.refresh()
    } catch { setError(t('access.actionFailed')); submitting.current = false; setBusy(false) }
  }

  return <main className={styles.card}><p className={styles.eyebrow}>{t('access.secureFirmAccess')}</p><h1 className={styles.title}>{t('access.resetPasswordTitle')}</h1><p className={styles.description}>{t('access.resetPasswordDescription')}</p><form className={styles.form} noValidate onSubmit={submit}><label className={styles.field}>{t('access.newPassword')}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></label><label className={styles.field}>{t('access.confirmNewPassword')}<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></label>{error && <p className={styles.alert} ref={alert} role="alert" tabIndex={-1}>{error}</p>}<button className={styles.submit} type="submit" disabled={busy}>{busy ? t('access.resettingPassword') : t('access.resetPassword')}</button></form></main>
}
