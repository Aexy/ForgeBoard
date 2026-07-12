import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('presents the accounting workflow foundation', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Monthly accounting' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Monthly accounting workflow' })).toBeInTheDocument()
  })
})

