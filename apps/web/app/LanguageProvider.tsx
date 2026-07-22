'use client'

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { languageCookie, messages, type Language, type MessageKey } from '@/lib/language'

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: MessageKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ initialLanguage, children }: Readonly<{ initialLanguage: Language; children: ReactNode }>) {
  const [language, setCurrentLanguage] = useState(initialLanguage)
  const router = useRouter()
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      setCurrentLanguage(nextLanguage)
      document.cookie = languageCookie(nextLanguage)
      document.documentElement.lang = nextLanguage
      router.refresh()
    },
    t(key) {
      return messages[language][key]
    },
  }), [language, router])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const language = useContext(LanguageContext)
  if (!language) throw new Error('useLanguage must be used inside LanguageProvider')
  return language
}
