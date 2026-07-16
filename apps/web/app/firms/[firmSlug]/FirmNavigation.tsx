import Link from 'next/link'

import type { FirmContext } from '@/lib/firm-context'

import styles from './FirmNavigation.module.css'

const commonLinks = [
  { href: 'workflow', label: 'Workflow' },
  { href: 'my-work', label: 'My work' },
  { href: 'clients', label: 'Clients' },
  { href: 'engagements', label: 'Engagements' },
]

export function FirmNavigation({ firm }: Readonly<{ firm: FirmContext }>) {
  const links = [
    ...commonLinks,
    ...(firm.role === 'OWNER' || firm.role === 'ADMINISTRATOR'
      ? [{ href: 'employees', label: 'Employees' }]
      : []),
    ...(firm.role === 'OWNER' || firm.role === 'MANAGER'
      ? [{ href: 'audit-trail', label: 'Activity trail' }]
      : []),
  ]

  return (
    <nav className={styles.navigation} aria-label={`${firm.firmSlug} workspace`}>
      <Link className={styles.brand} href={`/firms/${firm.firmSlug}/workflow`}>ForgeBoard</Link>
      <p className={styles.caption}>Firm workspace</p>
      <ul className={styles.links}>
        {links.map((link) => (
          <li key={link.href}><Link href={`/firms/${firm.firmSlug}/${link.href}`}>{link.label}</Link></li>
        ))}
      </ul>
    </nav>
  )
}
