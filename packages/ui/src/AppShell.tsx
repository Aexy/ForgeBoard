import type { ReactNode } from 'react'

import styles from './AppShell.module.css'

export interface AppShellProps {
  navigation: ReactNode
  children: ReactNode
}

export function AppShell({ navigation, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.navigation} aria-label="Firm navigation">{navigation}</aside>
      <main className={styles.content}>{children}</main>
    </div>
  )
}
