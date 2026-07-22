// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.get }) }))
vi.mock('@/store/provider', () => ({ StoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/app/LanguageProvider', () => ({ LanguageProvider: ({ initialLanguage, children }: { initialLanguage: string; children: React.ReactNode }) => <div data-language={initialLanguage}>{children}</div> }))

import RootLayout from '@/app/layout'

describe('root layout language', () => {
  it('uses the cookie value for the document and provider initial state', async () => {
    mocks.get.mockReturnValue({ value: 'de' })
    render(await RootLayout({ children: <p>Inhalt</p> }))

    expect(document.documentElement).toHaveAttribute('lang', 'de')
    expect(screen.getByText('Inhalt').parentElement).toHaveAttribute('data-language', 'de')
  })
})
