'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { useLanguage } from '@/app/LanguageProvider'
import styles from './AccessActionForm.module.css'

type InvitationMode = 'new-account' | 'existing-account'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InvitationAcceptanceForm({ token }: Readonly<{ token: string }>) {
  const { t } = useLanguage()
  const router = useRouter()
  const [mode, setMode] = useState<InvitationMode>('new-account')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const alert = useRef<HTMLParagraphElement>(null)

  useEffect(() => { if (error) alert.current?.focus() }, [error])

  async function finish() {
    await signOut({ redirect: false })
    router.replace('/sign-in')
    router.refresh()
  }

  async function submitNewAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const displayName = String(data.get('displayName') ?? '').trim()
    const password = String(data.get('password') ?? '')
    if (!displayName || !password || !String(data.get('passwordConfirmation') ?? '')) { setError(t('access.requiredFields')); return }
    if (password.length < 12) { setError(t('access.passwordTooShort')); return }
    if (password !== String(data.get('passwordConfirmation') ?? '')) { setError(t('access.passwordMismatch')); return }
    submitting.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/forgeboard/access/invitations/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, password }) })
      if (!response.ok) throw new Error('Invitation acceptance failed')
      await finish()
    } catch { setError(t('access.actionFailed')); submitting.current = false; setBusy(false) }
  }

  async function submitExistingAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    if (!email || !password) { setError(t('access.requiredFields')); return }
    if (!emailPattern.test(email)) { setError(t('access.invalidEmail')); return }
    submitting.current = true; setBusy(true); setError('')
    try {
      const signInResult = await signIn('credentials', { email, password, redirect: false })
      if (!signInResult?.ok || signInResult.error) throw new Error('Sign-in failed')
      const response = await fetch(`/api/forgeboard/access/invitations/${encodeURIComponent(token)}`, { method: 'PUT' })
      if (!response.ok) throw new Error('Invitation acceptance failed')
      await finish()
    } catch { setError(t('access.actionFailed')); submitting.current = false; setBusy(false) }
  }

  function changeMode(nextMode: InvitationMode) { if (!busy) { setError(''); setMode(nextMode) } }

  return <main className={styles.card}>
    <p className={styles.eyebrow}>{t('access.secureFirmAccess')}</p><h1 className={styles.title}>{t('access.acceptInvitationTitle')}</h1><p className={styles.description}>{t('access.acceptInvitationDescription')}</p>
    <div className={styles.mode} aria-label={t('access.invitationAccountChoice')}><button className={styles.modeButton} type="button" aria-pressed={mode === 'new-account'} onClick={() => changeMode('new-account')} disabled={busy}>{t('access.createAccount')}</button><button className={styles.modeButton} type="button" aria-pressed={mode === 'existing-account'} onClick={() => changeMode('existing-account')} disabled={busy}>{t('access.hasExistingAccount')}</button></div>
    {mode === 'new-account' ? <form className={styles.form} noValidate onSubmit={submitNewAccount}><label className={styles.field}>{t('access.yourName')}<input name="displayName" autoComplete="name" required maxLength={160} /></label><label className={styles.field}>{t('access.password')}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></label><label className={styles.field}>{t('access.confirmPassword')}<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></label>{error && <p className={styles.alert} ref={alert} role="alert" tabIndex={-1}>{error}</p>}<button className={styles.submit} type="submit" disabled={busy}>{busy ? t('access.acceptingInvitation') : t('access.acceptInvitation')}</button></form> : <form className={styles.form} noValidate onSubmit={submitExistingAccount}><label className={styles.field}>{t('access.emailAddress')}<input name="email" type="email" autoComplete="email" required /></label><label className={styles.field}>{t('access.password')}<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className={styles.alert} ref={alert} role="alert" tabIndex={-1}>{error}</p>}<button className={styles.submit} type="submit" disabled={busy}>{busy ? t('access.acceptingInvitation') : t('access.signInAndAcceptInvitation')}</button></form>}
  </main>
}
