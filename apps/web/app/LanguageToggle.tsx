'use client'

import { useLanguage } from './LanguageProvider'
import styles from './LanguageToggle.module.css'

export function LanguageToggle({ className }: Readonly<{ className?: string }>) {
  const { language, setLanguage, t } = useLanguage()
  const classes = className ? `${styles.toggle} ${className}` : styles.toggle

  return <div className={classes} role="group" aria-label={t('common.language')}>
    <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
    <button type="button" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>Deutsch</button>
  </div>
}
