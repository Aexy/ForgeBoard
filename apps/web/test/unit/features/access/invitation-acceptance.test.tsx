// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { InvitationAcceptanceForm } from '@/features/access/InvitationAcceptanceForm'

function renderForm(language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><InvitationAcceptanceForm token="invite-token" /></LanguageProvider>)
}

describe('invitation acceptance form', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mocks.signIn.mockReset()
    mocks.signOut.mockReset()
    mocks.replace.mockReset()
    mocks.refresh.mockReset()
  })

  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('submits a new account invitation with labeled new-password inputs and redirects to fresh sign-in', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ completed: true }), { status: 200 }))
    mocks.signOut.mockResolvedValue(undefined)
    renderForm()

    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mira Member' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'correct horse battery' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Accept invitation' }).closest('form')!)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/forgeboard/access/invitations/invite-token', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Mira Member', password: 'correct horse battery' }),
    })))
    await vi.waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false }))
    expect(mocks.replace).toHaveBeenCalledWith('/sign-in')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('redirects to fresh sign-in without an alert when sign-out fails after a successful invitation', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ completed: true }), { status: 200 }))
    mocks.signOut.mockRejectedValue(new Error('Sign-out unavailable'))
    renderForm()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mira Member' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'correct horse battery' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Accept invitation' }).closest('form')!)

    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/sign-in'))
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows and focuses the translated password validation alert', async () => {
    renderForm('de')
    fireEvent.change(screen.getByLabelText('Ihr Name'), { target: { value: 'Mira Mitglied' } })
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'one sufficiently long password' } })
    fireEvent.change(screen.getByLabelText('Passwort bestätigen'), { target: { value: 'two sufficiently long password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Einladung annehmen' }).closest('form')!)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Die Passwörter stimmen nicht überein.')
    expect(alert).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses a translated, focused alert for a normal submit with missing required fields', async () => {
    renderForm('de')
    fireEvent.click(screen.getByRole('button', { name: 'Einladung annehmen' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Füllen Sie alle Pflichtfelder aus.')
    expect(alert).toHaveFocus()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('disables repeated new-account submissions while the public request is pending', async () => {
    let finishRequest: (response: Response) => void = () => undefined
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((resolve) => { finishRequest = resolve }))
    renderForm()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mira Member' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'correct horse battery' } })
    const form = screen.getByRole('button', { name: 'Accept invitation' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(await screen.findByRole('button', { name: 'Accepting invitation…' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledOnce()
    finishRequest(new Response(JSON.stringify({ completed: true }), { status: 200 }))
  })

  it('hands existing account acceptance through Auth.js then the authenticated BFF handler and fresh sign-in', async () => {
    mocks.signIn.mockResolvedValue({ ok: true })
    mocks.signOut.mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ completed: true }), { status: 200 }))
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mira@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in and accept invitation' }).closest('form')!)

    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('credentials', {
      email: 'mira@example.com', password: 'correct horse battery', redirect: false,
    }))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/forgeboard/access/invitations/invite-token', expect.objectContaining({ method: 'PUT' })))
    await vi.waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false }))
    expect(mocks.replace).toHaveBeenCalledWith('/sign-in')
  })

  it('uses a translated, focused alert for a malformed existing-account email', async () => {
    renderForm('de')
    fireEvent.click(screen.getByRole('button', { name: 'Ich habe bereits ein Konto' }))
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden und Einladung annehmen' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Geben Sie eine gültige E-Mail-Adresse ein.')
    expect(alert).toHaveFocus()
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
