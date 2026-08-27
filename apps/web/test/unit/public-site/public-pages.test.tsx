// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContactPageContent } from '@/features/public-site/ContactPageContent'
import { ProductPageContent } from '@/features/public-site/ProductPageContent'
import { WhyForgeBoardPageContent } from '@/features/public-site/WhyForgeBoardPageContent'

describe('public page content', () => {
  it('describes the workflow on Product', () => {
    render(<ProductPageContent />)

    const heading = screen.getByRole('heading', { name: 'A dependable workflow for every client engagement.' })
    const illustration = screen.getByTestId('product-workflow-illustration')
    expect(heading).toBeVisible()
    expect(illustration).not.toContainElement(heading)
    expect(illustration.querySelector('[data-layout="embedded"]')).toBeInTheDocument()
    expect(screen.getByText('Prepare')).toBeVisible()
    expect(screen.getByText('Review')).toBeVisible()
    expect(screen.getByText('Complete')).toBeVisible()
  })

  it('shows the fixed proof point without claiming it is live', () => {
    render(<WhyForgeBoardPageContent />)

    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('accounting professionals use ForgeBoard.')).toBeVisible()
    expect(screen.queryByText(/live users/i)).not.toBeInTheDocument()
  })

  it('uses the approved email-app contact action', () => {
    render(<ContactPageContent />)

    expect(screen.getByRole('link', { name: 'Email ForgeBoard' })).toHaveAttribute('href', 'mailto:ali.aikaraca@gmail.com')
    expect(screen.getByText('ali.aikaraca@gmail.com')).toBeVisible()
  })
})
