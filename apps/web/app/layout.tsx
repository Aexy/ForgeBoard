import type { Metadata } from 'next'
import './globals.css'

import { StoreProvider } from '@/store/provider'

export const metadata: Metadata = {
  title: 'ForgeBoard',
  description: 'From deadline to done.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StoreProvider>{children}</StoreProvider></body></html>
}
