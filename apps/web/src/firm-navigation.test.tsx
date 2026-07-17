// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ usePathname: vi.fn(() => '/firms/hearth/workflow') }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname }))

import { FirmNavigation } from '@/app/firms/[firmSlug]/FirmNavigation'

describe('firm navigation', () => {
  afterEach(cleanup)

  it('uses firm-scoped links and marks the matching route active', () => {
    render(<FirmNavigation firm={{ firmId: 'firm-1', firmSlug: 'hearth', role: 'OWNER' }} userEmail="owner@example.com" />)

    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('href', '/firms/hearth/workflow')
    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/firms/hearth/employees')
    expect(screen.getByRole('link', { name: 'Activity trail' })).toHaveAttribute('href', '/firms/hearth/audit-trail')
    expect(screen.getByRole('img', { name: 'ForgeBoard' })).toHaveAttribute('src', '/forgeboard-logo.svg')
  })

  it('keeps employee navigation hidden for non-administrators', () => {
    render(<FirmNavigation firm={{ firmId: 'firm-1', firmSlug: 'hearth', role: 'MANAGER' }} userEmail="manager@example.com" />)

    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activity trail' })).toBeInTheDocument()
  })
})
