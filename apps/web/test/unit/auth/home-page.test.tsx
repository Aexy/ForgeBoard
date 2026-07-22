// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), signIn: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { AccessScreen } from '@/app/(auth)/AccessScreen'

describe('public access screen', () => {
  afterEach(() => {
    cleanup()
    mocks.push.mockReset()
    mocks.refresh.mockReset()
    mocks.signIn.mockReset()
  })

  it('places the language selector on the public access screen', () => {
    render(<LanguageProvider initialLanguage="en"><AccessScreen /></LanguageProvider>)

    expect(screen.getByRole('group', { name: 'Language' })).toBeVisible()
  })

  it('renders German onboarding validation copy', () => {
    render(<LanguageProvider initialLanguage="de"><AccessScreen /></LanguageProvider>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Firma erstellen' })[0])
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'first-password' } })
    fireEvent.change(screen.getByLabelText('Passwort bestätigen'), { target: { value: 'second-password' } })
    fireEvent.submit(screen.getAllByRole('button', { name: 'Firma erstellen' })[1].closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('Die Passwörter stimmen nicht überein')
  })
})
