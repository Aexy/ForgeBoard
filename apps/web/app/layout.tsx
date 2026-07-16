import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ForgeBoard',
  description: 'From deadline to done.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
