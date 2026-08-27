// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomeHero } from '@/features/public-site/HomeHero'

describe('HomeHero', () => {
  it('links its primary action to Product and hides its visual mark', () => {
    render(<HomeHero />)

    expect(screen.getByRole('heading', { name: 'The calm, accountable way to run client work.' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '/product')
    expect(screen.getByText('PREPARE')).toHaveAttribute('aria-hidden', 'true')
  })
})
