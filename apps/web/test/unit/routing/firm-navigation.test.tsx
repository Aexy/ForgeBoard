// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ usePathname: vi.fn(() => '/firms/hearth/workflow') }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname, useRouter: () => ({ refresh: vi.fn() }) }))

import { LanguageProvider } from '@/app/LanguageProvider'
import { FirmNavigation } from '@/app/firms/[firmSlug]/FirmNavigation'

function renderNavigation(role: 'OWNER' | 'MANAGER' = 'OWNER', language: 'en' | 'de' = 'en') {
  return render(<LanguageProvider initialLanguage={language}><FirmNavigation firm={{ firmId: 'firm-1', firmSlug: 'hearth', role }} userEmail="owner@example.com" /></LanguageProvider>)
}

describe('firm navigation', () => {
  afterEach(cleanup)

  it('uses firm-scoped links and marks the matching route active', () => {
    renderNavigation()

    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('href', '/firms/hearth/workflow')
    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/firms/hearth/employees')
    expect(screen.getByRole('link', { name: 'Activity trail' })).toHaveAttribute('href', '/firms/hearth/audit-trail')
    expect(screen.getByRole('img', { name: 'ForgeBoard' })).toHaveAttribute('src', '/forgeboard-logo.svg')
  })

  it('keeps employee navigation hidden for non-administrators', () => {
    renderNavigation('MANAGER')

    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activity trail' })).toBeInTheDocument()
  })

  it('places the desktop selector next to the ForgeBoard mark and retains it in the expanded mobile menu', () => {
    renderNavigation()

    const [desktopLanguage, mobileLanguage] = screen.getAllByRole('group', { name: 'Language' })
    expect(screen.getByRole('link', { name: 'ForgeBoard home' }).parentElement).toContainElement(desktopLanguage)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(navigation).toHaveAttribute('data-mobile-open', 'true')
    expect(within(navigation).getByRole('group', { name: 'Language' })).toBe(mobileLanguage)
  })

  it('renders German navigation labels while retaining firm-scoped hrefs', () => {
    renderNavigation('OWNER', 'de')

    expect(screen.getByRole('link', { name: 'Meine Aufgaben' })).toHaveAttribute('href', '/firms/hearth/my-work')
    expect(screen.getByRole('link', { name: 'Mandanten' })).toHaveAttribute('href', '/firms/hearth/clients')
    expect(screen.getAllByRole('button', { name: 'Abmelden' })).toHaveLength(2)
  })
})
