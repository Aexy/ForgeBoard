'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { SignInForm } from './sign-in/SignInForm'
import styles from './AccessScreen.module.css'

type OnboardingResult = { firmSlug?: unknown }

export function AccessScreen({ callbackUrl }: Readonly<{ callbackUrl?: string }>) {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'onboarding'>('sign-in')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function onboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    if (password !== String(data.get('passwordConfirmation') ?? '')) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/forgeboard/onboarding/firms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firmName: data.get('firmName'), firmSlug: data.get('firmSlug'), ownerName: data.get('ownerName'), ownerEmail: data.get('email'), password }) })
      const result = await response.json().catch(() => ({})) as OnboardingResult
      if (!response.ok || typeof result.firmSlug !== 'string') throw new Error('Onboarding failed')
      const destination = `/firms/${result.firmSlug}/my-work`
      const signedIn = await signIn('credentials', { email: String(data.get('email') ?? ''), password, redirect: false, callbackUrl: destination })
      if (signedIn?.error) throw new Error('Sign-in failed')
      router.push(destination); router.refresh()
    } catch { setError('We could not create your firm. Review the details and try again.') } finally { setBusy(false) }
  }
  return <main className={styles.shell}><section className={styles.intro} aria-label="ForgeBoard introduction"><img className={styles.logo} src="/forgeboard-logo.svg" alt="ForgeBoard" /><div className={styles.hero}><p className={styles.eyebrow}>The client-work operating system</p><h1>Clarity for every <em>client engagement.</em></h1><p className={styles.heroText}>ForgeBoard gives accounting teams one calm, accountable place to run deadlines, handoffs, and recurring work.</p></div><div className={styles.proof}><div><strong>One view</strong><span>of every active engagement</span></div><div><strong>Clear ownership</strong><span>from preparation to review</span></div><div><strong>Audit ready</strong><span>with every change recorded</span></div></div><div className={styles.frame} aria-hidden="true" /></section><section className={styles.side}><div className={styles.panel} aria-labelledby="access-title"><p className={styles.wordmark}>ForgeBoard</p><p className={styles.kicker}>Secure firm access</p><h2 id="access-title">{mode === 'sign-in' ? 'Welcome back' : 'Build your workspace'}</h2><p className={styles.description}>{mode === 'sign-in' ? 'Pick up where your team left off.' : 'Create the first owner account for your firm.'}</p><div className={styles.modes} aria-label="Account access"><button type="button" aria-pressed={mode === 'sign-in'} onClick={() => setMode('sign-in')}>I have an account</button><button type="button" aria-pressed={mode === 'onboarding'} onClick={() => setMode('onboarding')}>Create a firm</button></div>{mode === 'sign-in' ? <SignInForm callbackUrl={callbackUrl} className={styles.form} /> : <form className={styles.form} onSubmit={onboard}><label>Firm name<input name="firmName" autoComplete="organization" required maxLength={160} /></label><label>Workspace address<input name="firmSlug" autoComplete="off" required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="hearth-accounting" /></label><label>Your name<input name="ownerName" autoComplete="name" required maxLength={160} /></label><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label>Confirm password<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Create firm'}</button></form>}<p className={styles.security}><span>●</span> Tenant-isolated and audit-ready by design</p></div></section></main>
}
