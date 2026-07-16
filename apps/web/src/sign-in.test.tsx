// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
import { SignInForm } from '@/app/(auth)/sign-in/SignInForm'

describe('sign-in form', () => {
  afterEach(cleanup)
  beforeEach(() => { mocks.signIn.mockReset(); mocks.push.mockReset(); mocks.refresh.mockReset() })
  it('signs in and returns to the requested firm route', async () => {
    mocks.signIn.mockResolvedValue({ url: '/firms/hearth/my-work' })
    render(<SignInForm callbackUrl="/firms/hearth/my-work" />)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({ email: 'owner@example.com', password: 'correct-password', callbackUrl: '/firms/hearth/my-work' })))
    expect(mocks.push).toHaveBeenCalledWith('/firms/hearth/my-work')
  })
  it('shows a recoverable error after failed credentials', async () => {
    mocks.signIn.mockResolvedValue({ error: 'CredentialsSignin' })
    render(<SignInForm />)
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in')
  })
})
