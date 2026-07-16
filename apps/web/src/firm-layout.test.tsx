// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: vi.fn(() => { throw new Error('REDIRECT') }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))

vi.mock('@forgeboard/ui', () => ({
  AppShell: ({ navigation, children }: { navigation: ReactNode; children: ReactNode }) => <div>{navigation}{children}</div>,
}))

vi.mock('@/store/firm-cache-boundary', () => ({
  FirmCacheBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  FirmContextProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import FirmLayout from '@/app/firms/[firmSlug]/layout'
import { FirmNavigation } from '@/app/firms/[firmSlug]/FirmNavigation'

const accessibleSession = {
  user: { id: 'user-1', email: 'owner@example.com' },
  firms: [{ id: 'firm-1', slug: 'hearth-accounting', name: 'Hearth Accounting', role: 'OWNER' as const }],
}

describe('firm route layout', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.notFound.mockClear()
    mocks.redirect.mockClear()
  })

  it('renders an accessible direct firm route with immutable firm context attributes', async () => {
    mocks.auth.mockResolvedValue(accessibleSession)

    render(await FirmLayout({
      children: <p>My work content</p>,
      params: Promise.resolve({ firmSlug: 'hearth-accounting' }),
    }))

    expect(screen.getByText('My work content')).toBeVisible()
    expect(screen.getByText('My work content').parentElement).toHaveAttribute('data-firm-id', 'firm-1')
    expect(screen.getByText('My work content').parentElement).toHaveAttribute('data-firm-slug', 'hearth-accounting')
    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  it('uses the Next not-found boundary for an inaccessible firm slug', async () => {
    mocks.auth.mockResolvedValue(accessibleSession)

    await expect(FirmLayout({
      children: <p>Unreachable</p>,
      params: Promise.resolve({ firmSlug: 'other-firm' }),
    })).rejects.toThrow('NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })

  it('uses firm-scoped links rather than local view state', () => {
    render(<FirmNavigation firm={{
      firmId: accessibleSession.firms[0].id,
      firmSlug: accessibleSession.firms[0].slug,
      role: accessibleSession.firms[0].role,
    }} />)

    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('href', '/firms/hearth-accounting/workflow')
    expect(screen.getByRole('link', { name: 'My work' })).toHaveAttribute('href', '/firms/hearth-accounting/my-work')
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/firms/hearth-accounting/employees')
  })
})
