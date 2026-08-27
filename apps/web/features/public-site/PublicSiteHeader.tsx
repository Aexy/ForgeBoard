'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

import styles from './PublicSiteHeader.module.css'

export type PublicPath = '/' | '/product' | '/why-forgeboard' | '/contact'

const navigation: ReadonlyArray<{ href: PublicPath; label: string }> = [
  { href: '/product', label: 'Product' },
  { href: '/why-forgeboard', label: 'Why ForgeBoard' },
  { href: '/contact', label: 'Contact' },
]

export function PublicSiteHeader({ activePath }: Readonly<{ activePath?: PublicPath }>) {
  const mobileNavigationRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !mobileNavigationRef.current?.open) return

      mobileNavigationRef.current.open = false
      summaryRef.current?.focus()
    }

    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [])

  function closeMobileNavigation() {
    if (mobileNavigationRef.current) mobileNavigationRef.current.open = false
  }

  const links = (onNavigate?: () => void) => <>
    {navigation.map((item) => <Link
      key={item.href}
      href={item.href}
      aria-current={activePath === item.href ? 'page' : undefined}
      onClick={onNavigate}
    >
      {item.label}
    </Link>)}
    <Link className={styles.login} href="/sign-in" onClick={onNavigate}>Log in</Link>
  </>

  return <header className={styles.header}>
    <Link className={styles.logo} href="/" aria-label="ForgeBoard">
      <Image className={styles.logoImage} src="/forgeboard-logo.svg" alt="" width={180} height={47} priority />
    </Link>
    <nav className={styles.desktopNavigation} aria-label="Public navigation">
      {links()}
    </nav>
    <details ref={mobileNavigationRef} className={styles.mobileNavigation} data-testid="mobile-public-navigation">
      <summary ref={summaryRef} className={styles.menuButton}>Menu</summary>
      <nav className={styles.navigation} aria-label="Mobile public navigation">
        {links(closeMobileNavigation)}
      </nav>
    </details>
  </header>
}
