// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ContactPageContent } from '@/features/public-site/ContactPageContent'
import { ProductPageContent } from '@/features/public-site/ProductPageContent'
import { WhyForgeBoardPageContent } from '@/features/public-site/WhyForgeBoardPageContent'

afterEach(cleanup)

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

  it('tells the approved Why ForgeBoard narrative in one page hierarchy', () => {
    render(<WhyForgeBoardPageContent />)

    const expectedHeadings = [
      'Work should not disappear between a spreadsheet, inbox, and deadline.',
      'Built for the way accounting firms actually work.',
      "The problem isn't another task list.",
      'Know where the firm needs attention.',
      'Stop rebuilding the same work every month.',
      "Done isn't the same as reviewed.",
      "Sometimes your team isn't the blocker.",
      'ForgeBoard coordinates the work around your accounting systems.',
      'Run recurring client work with fewer blind spots.',
    ]

    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual(expectedHeadings)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(expectedHeadings.slice(1))
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByText('Overdue')).toBeVisible()
    expect(screen.getAllByText('Awaiting review')[0]).toBeVisible()
    expect(screen.getByText('Waiting on client')).toBeVisible()
    expect(screen.getByText('Monthly bookkeeping template')).toBeVisible()
    expect(screen.getByText('Linked workflow')).toBeVisible()
    expect(screen.getByText('Prepare, reconcile, review')).toBeVisible()
    expect(screen.getByText('Recurrence')).toBeVisible()
    expect(screen.getByText('Monthly')).toBeVisible()
    expect(screen.getByText('Default work item')).toBeVisible()
    expect(screen.getByText('Prepare monthly bookkeeping')).toBeVisible()
    expect(screen.getByText('Due day')).toBeVisible()
    expect(screen.getByText('10th of each month')).toBeVisible()
    expect(screen.queryByText('Bookkeeping team')).not.toBeInTheDocument()
    expect(screen.queryByText('Senior accountant')).not.toBeInTheDocument()

    const comparison = screen.getByRole('list', { name: 'Spreadsheet and inbox compared with ForgeBoard' })
    const pairs = within(comparison).getAllByRole('listitem')
    expect(pairs).toHaveLength(6)
    expect(pairs.map((pair) => pair.textContent)).toEqual([
      'Spreadsheet + inboxWork exists in separate placesForgeBoardLive workflow',
      'Spreadsheet + inboxEmail carries the contextForgeBoardContext stays with the work',
      'Spreadsheet + inboxDeadlines are rememberedForgeBoardDeadline risk is visible',
      'Spreadsheet + inboxOwnership lives in people’s headsForgeBoardThe next action has an owner',
      'Spreadsheet + inboxReview is informalForgeBoardReview follows the workflow',
      'Spreadsheet + inboxHistory is scatteredForgeBoardMaterial activity is traceable',
    ])
    const reviewFlow = screen.getByRole('list', { name: 'Review accountability flow' })
    expect(reviewFlow.tagName).toBe('OL')
    expect(within(reviewFlow).getByText('Anna preparing')).toBeVisible()
    expect(within(reviewFlow).getByText('Submitted for review')).toBeVisible()
    expect(within(reviewFlow).getByText('Markus reviewing')).toBeVisible()
    expect(within(reviewFlow).getByText('Approved')).toBeVisible()
    expect(screen.getByText('Returned for correction')).toBeVisible()
    expect(screen.getByText('Missing supporting documentation for Q2.')).toBeVisible()

    const clientWork = screen.getByRole('list', { name: 'Client work status' })
    expect(clientWork).toHaveTextContent('Muster GmbH')
    expect(clientWork).toHaveTextContent('VAT Q3')
    expect(clientWork).toHaveTextContent('Waiting for bank statements')
    expect(clientWork).toHaveTextContent('Client action required')
    expect(clientWork).toHaveTextContent('Schmidt KG')
    expect(clientWork).toHaveTextContent('Payroll August')
    expect(clientWork).toHaveTextContent('Preparation complete')
    expect(clientWork).toHaveTextContent('Awaiting review')
    expect(clientWork).toHaveTextContent('Nova GmbH')
    expect(clientWork).toHaveTextContent('Monthly bookkeeping')
    expect(clientWork).toHaveTextContent('In progress')
    expect(clientWork).toHaveTextContent('Owner: Lukas')
    expect(clientWork).toHaveTextContent('Due in 2 days')
    const novaCard = within(clientWork).getByText('Nova GmbH').closest('li')
    if (!novaCard) {
      throw new Error('Nova client card is missing')
    }
    expect(within(novaCard).getByText('In progress')).toBeVisible()
    expect(within(novaCard).getByText('Owner: Lukas')).toBeVisible()
    expect(within(novaCard).getByText('Due in 2 days')).toBeVisible()
    expect(novaCard).toHaveTextContent(/In progress[\s\S]*Owner: Lukas[\s\S]*Due in 2 days/)
    expect(screen.getByRole('link', { name: /talk to forgeboard/i })).toHaveAttribute('href', '/contact')
  })

  it('uses the approved email-app contact action', () => {
    render(<ContactPageContent />)

    expect(screen.getByRole('link', { name: 'Email ForgeBoard' })).toHaveAttribute('href', 'mailto:ali.aikaraca@gmail.com')
    expect(screen.getByText('ali.aikaraca@gmail.com')).toBeVisible()
  })
})
