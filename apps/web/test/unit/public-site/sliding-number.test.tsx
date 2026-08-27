// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SlidingNumber } from '@/features/public-site/SlidingNumber'

describe('SlidingNumber', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders its final accessible value before animation', () => {
    const { container } = render(<SlidingNumber value={28} />)

    const staticValue = screen.getByText('28')
    expect(staticValue).not.toHaveAttribute('aria-hidden')
    expect(staticValue.className).toContain('staticValue')
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('0123456789')
    expect(container.querySelector('[aria-label]')).not.toBeInTheDocument()
  })

  it('does not create an observer for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe, disconnect: vi.fn() })))

    render(<SlidingNumber value={28} />)

    expect(observe).not.toHaveBeenCalled()
  })

  it('formats large values without exponential digits or NaN tracks', () => {
    const { container } = render(<SlidingNumber value={1e21} />)

    expect(screen.getByText('1000000000000000000000')).toBeInTheDocument()
    expect(container).not.toHaveTextContent('NaN')
  })
})
