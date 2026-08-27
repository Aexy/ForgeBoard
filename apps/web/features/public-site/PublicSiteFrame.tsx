import type { ReactNode } from 'react'

import { PublicSiteFooter } from './PublicSiteFooter'
import { PublicSiteHeader, type PublicPath } from './PublicSiteHeader'
import styles from './PublicSiteFrame.module.css'

export function PublicSiteFrame({ activePath, children }: Readonly<{ activePath?: PublicPath; children: ReactNode }>) {
  return <div className={styles.frame} lang="en">
    <a className={styles.skipLink} href="#main-content">Skip to main content</a>
    <PublicSiteHeader activePath={activePath} />
    <main id="main-content">{children}</main>
    <PublicSiteFooter />
  </div>
}
