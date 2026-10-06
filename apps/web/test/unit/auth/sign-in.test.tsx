// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))
import { SignInForm } from '@/app/(auth)/sign-in/SignInForm'
import { LanguageProvider } from '@/app/LanguageProvider'

function renderWithLanguage(language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><SignInForm /></LanguageProvider>)
}

describe('sign-in form', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.signIn.mockReset(); mocks.replace.mockReset(); mocks.refresh.mockReset() })
  it('signs in and returns to the requested firm route', async () => {
    mocks.signIn.mockResolvedValue({ url: '/firms/hearth/my-work' })
    render(<LanguageProvider initialLanguage="en"><SignInForm callbackUrl="/firms/hearth/my-work" /></LanguageProvider>)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({ email: 'owner@example.com', password: 'correct-password', remember: false, callbackUrl: '/firms/hearth/my-work' })))
    expect(mocks.replace).toHaveBeenCalledWith('/?callbackUrl=%2Ffirms%2Fhearth%2Fmy-work&postSignIn=1')
    const pending = screen.getByRole('button', { name: 'Signing in…' })
    expect(pending).toBeDisabled()
    fireEvent.submit(pending.closest('form')!)
    expect(mocks.signIn).toHaveBeenCalledTimes(1)
  })
  it('shows a recoverable error after failed credentials', async () => {
    mocks.signIn.mockResolvedValue({ error: 'CredentialsSignin' })
    renderWithLanguage()
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it.each([
    ['en', 'Password', 'Show password', 'Hide password', 'Contact your ForgeBoard administrator'],
    ['de', 'Passwort', 'Passwort anzeigen', 'Passwort verbergen', 'ForgeBoard-Administrator'],
  ] as const)('toggles password visibility without submitting in %s', (language, label, show, hide, guidance) => {
    renderWithLanguage(language)
    const password = screen.getByLabelText(label)
    fireEvent.change(password, { target: { value: 'correct-password' } })
    expect(password).toHaveAttribute('type', 'password')
    const toggle = screen.getByRole('button', { name: show })
    expect(toggle).toHaveAttribute('type', 'button')
    expect(toggle).toHaveAttribute('aria-controls', password.id)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('correct-password')
    expect(screen.getByRole('button', { name: hide })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: hide }))
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveValue('correct-password')
    expect(screen.getByText(new RegExp(guidance))).toBeVisible()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('sends the selected Remember me choice only with the credentials attempt', async () => {
    mocks.signIn.mockResolvedValue({ error: 'CredentialsSignin' })
    renderWithLanguage()
    const remember = screen.getByRole('checkbox', { name: 'Remember me for 30 days' })
    expect(remember).not.toBeChecked()
    fireEvent.click(remember)
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    await screen.findByRole('alert')
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({ remember: true }))
    expect(remember).toBeChecked()
  })
  it('allows retry after a rejected request without exposing its error or losing input', async () => {
    mocks.signIn.mockRejectedValueOnce(new Error('private upstream details')).mockResolvedValueOnce({ url: '/' })
    renderWithLanguage()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } })
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')!
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.queryByText(/private upstream details/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('correct-password')
    expect(screen.getByLabelText('Email address')).toHaveAttribute('spellcheck', 'false')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    fireEvent.submit(form)
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/?postSignIn=1'))
    expect(mocks.signIn).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('blocks synchronous duplicate submissions while a request is pending', async () => {
    let resolve!: (value: { error: string }) => void
    mocks.signIn.mockReturnValue(new Promise((done) => { resolve = done }))
    renderWithLanguage()
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')!
    act(() => { fireEvent.submit(form); fireEvent.submit(form) })
    expect(mocks.signIn).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    await act(async () => { resolve({ error: 'CredentialsSignin' }) })
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })
  it('treats a missing sign-in result as a recoverable failure', async () => {
    mocks.signIn.mockResolvedValue(undefined)
    renderWithLanguage()
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveFocus()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it('renders German labels and errors without changing the credentials payload', async () => {
    mocks.signIn.mockResolvedValue({ error: 'CredentialsSignin' })
    renderWithLanguage('de')
    expect(screen.getByRole('checkbox', { name: '30 Tage angemeldet bleiben' })).not.toBeChecked()
    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'correct-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Anmelden' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anmeldung war nicht möglich')
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({ email: 'owner@example.com', password: 'correct-password' }))
  })
})
