import Link from 'next/link'

import styles from './PublicSiteFooter.module.css'

export function PublicSiteFooter() {
  return <footer className={styles.footer}>
    <p>© {new Date().getFullYear()} ForgeBoard</p>
    <Link href="/contact">Contact</Link>
  </footer>
}
