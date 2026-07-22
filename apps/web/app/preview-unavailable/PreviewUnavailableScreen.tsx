'use client'

import { useLanguage } from '@/app/LanguageProvider'

export function PreviewUnavailableScreen() {
  const { t } = useLanguage()
  return <main><h1>{t('preview.title')}</h1><p>{t('preview.description')}</p></main>
}
