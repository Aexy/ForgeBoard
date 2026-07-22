// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { LanguageToggle } from '@/app/LanguageToggle'

describe('LanguageToggle', () => {
  afterEach(() => {
    cleanup()
    mocks.refresh.mockReset()
    document.cookie = 'forgeboard.language=; Path=/; Max-Age=0'
  })

  it('exposes the English and German choices with the current choice pressed', () => {
    render(<LanguageProvider initialLanguage="en"><LanguageToggle /></LanguageProvider>)

    expect(screen.getByRole('group', { name: 'Language' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('uses the German group label, updates selection, and retains button focus', () => {
    render(<LanguageProvider initialLanguage="de"><LanguageToggle /></LanguageProvider>)

    const english = screen.getByRole('button', { name: 'English' })
    expect(screen.getByRole('group', { name: 'Sprache' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')

    english.focus()
    fireEvent.click(english)

    expect(english).toHaveFocus()
    expect(english).toHaveAttribute('aria-pressed', 'true')
  })
})
