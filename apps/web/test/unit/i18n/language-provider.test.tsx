// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import { LanguageProvider, useLanguage } from '@/app/LanguageProvider'

function Probe() {
  const { language, setLanguage, t } = useLanguage()
  return <><p>{t('navigation.myWork')}</p><p data-testid="language">{language}</p><button type="button" onClick={() => setLanguage('de')}>Deutsch</button></>
}

describe('LanguageProvider', () => {
  afterEach(() => {
    mocks.refresh.mockReset()
    document.cookie = 'forgeboard.language=; Path=/; Max-Age=0'
    document.documentElement.lang = 'en'
  })

  it('updates the document, cookie, messages, and server-rendered route after a selection', () => {
    render(<LanguageProvider initialLanguage="en"><Probe /></LanguageProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }))

    expect(screen.getByTestId('language')).toHaveTextContent('de')
    expect(screen.getByText('Meine Aufgaben')).toBeVisible()
    expect(document.documentElement.lang).toBe('de')
    expect(document.cookie).toContain('forgeboard.language=de')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})
