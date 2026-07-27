import type { ReactNode } from 'react'

import styles from './AppShell.module.css'

export interface AppShellProps {
  navigation: ReactNode
  children: ReactNode
}

export function AppShell({ navigation, children }: Readonly<AppShellProps>) {
  return (
    <div className={styles.shell}>
      <aside className={styles.navigation}>{navigation}</aside>
      <main className={styles.content}>{children}</main>
    </div>
  )
}
