import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LanguageProvider, LanguageToggle, useLanguage } from './i18n'

function Probe() {
  const { t } = useLanguage()
  return <><LanguageToggle /><p>{t('Welcome back')}</p></>
}

describe('language selection', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to English and persists German after selection', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }))
    expect(screen.getByText('Willkommen zurück')).toBeInTheDocument()
    expect(localStorage.getItem('forgeboard.language')).toBe('de')
  })

  it('restores the saved language and exposes the selected state', () => {
    localStorage.setItem('forgeboard.language', 'de')
    render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
  })
})
