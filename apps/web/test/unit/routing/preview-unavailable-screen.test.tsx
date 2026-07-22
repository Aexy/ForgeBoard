// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { PreviewUnavailableScreen } from '@/app/preview-unavailable/PreviewUnavailableScreen'

describe('PreviewUnavailableScreen', () => {
  it('uses the shared German presentation preference', () => {
    render(<LanguageProvider initialLanguage="de"><PreviewUnavailableScreen /></LanguageProvider>)
    expect(screen.getByRole('heading', { name: 'Vorschauzugang ist nicht aktiviert' })).toBeVisible()
  })
})
