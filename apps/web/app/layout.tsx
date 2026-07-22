import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'

import { LanguageProvider } from '@/app/LanguageProvider'
import { LANGUAGE_COOKIE, readLanguage } from '@/lib/language'
import { StoreProvider } from '@/store/provider'

export const metadata: Metadata = {
  title: 'ForgeBoard',
  description: 'From deadline to done.',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const language = readLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value)

  return <html lang={language}><body><StoreProvider><LanguageProvider initialLanguage={language}>{children}</LanguageProvider></StoreProvider></body></html>
}
