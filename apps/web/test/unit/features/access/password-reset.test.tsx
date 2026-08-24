// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next-auth/react', () => ({ signOut: mocks.signOut }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { PasswordResetForm } from '@/features/access/PasswordResetForm'

function renderForm(language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><PasswordResetForm token="reset-token" /></LanguageProvider>)
}

describe('password reset form', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mocks.signOut.mockReset()
    mocks.replace.mockReset()
    mocks.refresh.mockReset()
  })

  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('posts the new password to the public reset BFF and forces fresh sign-in', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    mocks.signOut.mockResolvedValue(undefined)
    renderForm()
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('autocomplete', 'new-password')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'correct horse battery' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'correct horse battery' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/forgeboard/access/password-resets/reset-token', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'correct horse battery' }),
    })))
    await vi.waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false }))
    expect(mocks.replace).toHaveBeenCalledWith('/sign-in')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('shows and focuses a translated validation alert without calling the endpoint', async () => {
    renderForm('de')
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'one sufficiently long password' } })
    fireEvent.change(screen.getByLabelText('Neues Passwort bestätigen'), { target: { value: 'two sufficiently long password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Passwort zurücksetzen' }).closest('form')!)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Die Passwörter stimmen nicht überein.')
    expect(alert).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses a translated, focused alert for a normal submit with a short password', async () => {
    renderForm('de')
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'kurz' } })
    fireEvent.change(screen.getByLabelText('Neues Passwort bestätigen'), { target: { value: 'kurz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Passwort zurücksetzen' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Verwenden Sie mindestens 12 Zeichen für Ihr Passwort.')
    expect(alert).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('disables repeated submissions while a reset is pending', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined))
    renderForm()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'correct horse battery' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'correct horse battery' } })
    const form = screen.getByRole('button', { name: 'Reset password' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(await screen.findByRole('button', { name: 'Resetting password…' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledOnce()
  })
})
