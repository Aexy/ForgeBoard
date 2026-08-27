// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { PublicSiteFrame } from '@/features/public-site/PublicSiteFrame'
import { PublicSiteHeader } from '@/features/public-site/PublicSiteHeader'

afterEach(cleanup)

describe('PublicSiteHeader', () => {
  it('links the logo and all public destinations', () => {
    render(<PublicSiteHeader activePath="/product" />)

    expect(screen.getByRole('link', { name: 'ForgeBoard' })).toHaveAttribute('href', '/')
    const desktopNavigation = screen.getByRole('navigation', { name: 'Public navigation' })
    expect(within(desktopNavigation).getByRole('link', { name: 'Product' })).toHaveAttribute('href', '/product')
    expect(within(desktopNavigation).getByRole('link', { name: 'Why ForgeBoard' })).toHaveAttribute('href', '/why-forgeboard')
    expect(within(desktopNavigation).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
    expect(within(desktopNavigation).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/sign-in')
    expect(within(desktopNavigation).getByRole('link', { name: 'Product' })).toHaveAttribute('aria-current', 'page')
  })

  it('enhances the native mobile navigation by closing it with Escape', () => {
    render(<PublicSiteHeader />)

    const disclosure = screen.getByTestId('mobile-public-navigation') as HTMLDetailsElement
    const summary = within(disclosure).getByText('Menu')
    disclosure.open = true

    expect(disclosure).toHaveAttribute('open')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(disclosure).not.toHaveAttribute('open')
    expect(summary).toHaveFocus()
  })

  it('renders a native mobile disclosure and all required links before hydration', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<PublicSiteHeader />)
    const disclosure = container.querySelector('details')

    expect(disclosure?.querySelector('summary')).toHaveTextContent('Menu')
    expect(disclosure?.querySelector('a[href="/product"]')).toHaveTextContent('Product')
    expect(disclosure?.querySelector('a[href="/why-forgeboard"]')).toHaveTextContent('Why ForgeBoard')
    expect(disclosure?.querySelector('a[href="/contact"]')).toHaveTextContent('Contact')
    expect(disclosure?.querySelector('a[href="/sign-in"]')).toHaveTextContent('Log in')
  })

  it('provides an English public landmark and a skip link to its main content', () => {
    render(<PublicSiteFrame><p>Public content</p></PublicSiteFrame>)

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('main').closest('[lang]')).toHaveAttribute('lang', 'en')
  })
})
