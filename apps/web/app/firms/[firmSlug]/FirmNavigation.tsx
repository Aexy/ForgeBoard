'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import type { FirmContext } from '@/lib/firm-context'

import { LanguageToggle } from '../../LanguageToggle'
import styles from './FirmNavigation.module.css'

const commonLinks = [
  { href: 'workflow', label: 'Workflow' },
  { href: 'my-work', label: 'My work' },
  { href: 'clients', label: 'Clients' },
  { href: 'engagements', label: 'Engagements' },
]

type FirmNavigationProps = {
  firm: FirmContext
  userEmail: string
}

export function FirmNavigation({ firm, userEmail }: Readonly<FirmNavigationProps>) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const links = [
    ...commonLinks,
    ...(firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR'
      ? [{ href: 'employees', label: 'Employees' }]
      : []),
    ...(firm.role === 'OWNER' || firm.role === 'MANAGER'
      ? [{ href: 'audit-trail', label: 'Activity trail' }]
      : []),
  ]

  const initials = userEmail.slice(0, 1).toUpperCase()

  return <div className={styles.navigation}>
    <div className={styles.mobileHeader}>
      <Link className={styles.brand} href={`/firms/${firm.firmSlug}/workflow`} aria-label="ForgeBoard home">
        <img src="/forgeboard-logo.svg" alt="ForgeBoard" />
      </Link>
      <button className={styles.menuToggle} type="button" aria-expanded={mobileMenuOpen} aria-controls="firm-primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>Menu</button>
    </div>
    <div className={styles.workspaceLabel}><span>Workspace</span><strong>{firm.firmSlug}</strong></div>
    <nav id="firm-primary-navigation" className={styles.links} aria-label="Primary navigation" data-mobile-open={mobileMenuOpen}>
      <ol>
        {links.map((link, index) => {
          const href = `/firms/${firm.firmSlug}/${link.href}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return <li key={link.href}><Link href={href} aria-current={active ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>{link.label}</Link></li>
        })}
      </ol>
      <LanguageToggle className={styles.mobileLanguageToggle} />
      <button className={styles.mobileSignOut} type="button" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
    </nav>
    <aside className={styles.sidebarNote} aria-label="Workspace summary"><span>Everything in view</span><p>Deadlines, ownership, and handoffs in one accountable workspace.</p></aside>
    <div className={styles.account}>
      <span className={styles.avatar} aria-hidden="true">{initials}</span>
      <div><strong>{userEmail.split('@')[0]}</strong><span>{userEmail}</span></div>
      <LanguageToggle className={styles.desktopLanguageToggle} />
      <button className={styles.signOut} type="button" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
    </div>
  </div>
}
