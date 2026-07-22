'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { LanguageToggle } from '../LanguageToggle'
import { useLanguage } from '../LanguageProvider'
import { SignInForm } from './sign-in/SignInForm'
import styles from './AccessScreen.module.css'

type OnboardingResult = { firmSlug?: unknown }

export function AccessScreen({ callbackUrl }: Readonly<{ callbackUrl?: string }>) {
  const { t } = useLanguage()
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'onboarding'>('sign-in')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    if (password !== String(data.get('passwordConfirmation') ?? '')) {
      setError(t('access.passwordMismatch'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/forgeboard/onboarding/firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmName: data.get('firmName'), firmSlug: data.get('firmSlug'), ownerName: data.get('ownerName'), ownerEmail: data.get('email'), password }),
      })
      const result = await response.json().catch(() => ({})) as OnboardingResult
      if (!response.ok || typeof result.firmSlug !== 'string') throw new Error('Onboarding failed')
      const destination = `/firms/${result.firmSlug}/my-work`
      const signedIn = await signIn('credentials', { email: String(data.get('email') ?? ''), password, redirect: false, callbackUrl: destination })
      if (signedIn?.error) throw new Error('Sign-in failed')
      router.push(destination)
      router.refresh()
    } catch {
      setError(t('access.onboardingFailed'))
    } finally {
      setBusy(false)
    }
  }

  return <main className={styles.shell}>
    <section className={styles.intro} aria-label={t('access.introduction')}>
      <img className={styles.logo} src="/forgeboard-logo.svg" alt="ForgeBoard" />
      <div className={styles.hero}>
        <p className={styles.eyebrow}>{t('access.eyebrow')}</p>
        <h1>{t('access.title')}</h1>
        <p className={styles.heroText}>{t('access.description')}</p>
      </div>
      <div className={styles.proof}><div><strong>{t('access.oneView')}</strong><span>{t('access.oneViewDetail')}</span></div><div><strong>{t('access.clearOwnership')}</strong><span>{t('access.clearOwnershipDetail')}</span></div><div><strong>{t('access.auditReady')}</strong><span>{t('access.auditReadyDetail')}</span></div></div>
      <div className={styles.frame} aria-hidden="true" />
    </section>
    <section className={styles.side}>
      <div className={styles.panel} aria-labelledby="access-title">
        <div className={styles.panelHeader}><p className={styles.wordmark}>ForgeBoard</p><LanguageToggle /></div>
        <p className={styles.kicker}>{t('access.secureFirmAccess')}</p>
        <h2 id="access-title">{mode === 'sign-in' ? t('access.welcomeBack') : t('access.buildWorkspace')}</h2>
        <p className={styles.description}>{mode === 'sign-in' ? t('access.signInDescription') : t('access.onboardingDescription')}</p>
        <div className={styles.modes} aria-label={t('access.accountAccess')}><button type="button" aria-pressed={mode === 'sign-in'} onClick={() => setMode('sign-in')}>{t('access.hasAccount')}</button><button type="button" aria-pressed={mode === 'onboarding'} onClick={() => setMode('onboarding')}>{t('access.createFirm')}</button></div>
        {mode === 'sign-in' ? <SignInForm callbackUrl={callbackUrl} className={styles.form} /> : <form className={styles.form} onSubmit={onboard}>
          <label>{t('access.firmName')}<input name="firmName" autoComplete="organization" required maxLength={160} /></label>
          <label>{t('access.workspaceAddress')}<input name="firmSlug" autoComplete="off" required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="hearth-accounting" /></label>
          <label>{t('access.yourName')}<input name="ownerName" autoComplete="name" required maxLength={160} /></label>
          <label>{t('access.emailAddress')}<input name="email" type="email" autoComplete="email" required /></label>
          <label>{t('access.password')}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          <label>{t('access.confirmPassword')}<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? t('access.pleaseWait') : t('access.createFirmAction')}</button>
        </form>}
        <p className={styles.security}><span>●</span> {t('access.tenantSafe')}</p>
      </div>
    </section>
  </main>
}
