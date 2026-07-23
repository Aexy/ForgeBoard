'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

import { LanguageToggle } from '@/app/LanguageToggle'
import { useLanguage } from '@/app/LanguageProvider'

import styles from './PlatformNavigation.module.css'

export function PlatformNavigation({ userEmail }: Readonly<{ userEmail: string }>) {
  const { t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const initials = userEmail.slice(0, 1).toUpperCase()

  return <div className={styles.navigation}>
    <div className={styles.mobileHeader}>
      <Link className={styles.brand} href="/platform-admin" aria-label={t('navigation.home')}><img src="/forgeboard-logo.svg" alt="ForgeBoard" /></Link>
      <div className={styles.headerActions}>
        <LanguageToggle className={styles.desktopLanguageToggle} />
        <button className={styles.menuToggle} type="button" aria-expanded={mobileMenuOpen} aria-controls="platform-primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>{t('navigation.menu')}</button>
      </div>
    </div>
    <div className={styles.workspaceLabel}><span>{t('platformAdmin.eyebrow')}</span><strong>{t('platformAdmin.title')}</strong></div>
    <nav id="platform-primary-navigation" className={styles.links} aria-label={t('platformAdmin.title')} data-mobile-open={mobileMenuOpen}>
      <ol><li><Link href="/platform-admin" aria-current="page" onClick={() => setMobileMenuOpen(false)}><i aria-hidden="true">01</i>{t('platformAdmin.title')}</Link></li></ol>
      <LanguageToggle className={styles.mobileLanguageToggle} />
      <button className={styles.mobileSignOut} type="button" onClick={() => signOut({ callbackUrl: '/' })}>{t('navigation.signOut')}</button>
    </nav>
    <aside className={styles.sidebarNote} aria-label={t('platformAdmin.title')}><span>{t('platformAdmin.eyebrow')}</span><p>{t('platformAdmin.description')}</p></aside>
    <div className={styles.account}><span className={styles.avatar} aria-hidden="true">{initials}</span><div><strong>{userEmail.split('@')[0]}</strong><span>{userEmail}</span></div><button className={styles.signOut} type="button" onClick={() => signOut({ callbackUrl: '/' })}>{t('navigation.signOut')}</button></div>
  </div>
}
