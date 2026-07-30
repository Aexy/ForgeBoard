// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('uses accessible button semantics and remains keyboard-focusable', () => {
    render(<Button>Save changes</Button>)

    const button = screen.getByRole('button', { name: 'Save changes' })
    expect(button).toHaveAttribute('type', 'button')

    button.focus()
    expect(button).toHaveFocus()
  })

  it('prevents interaction while disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Save changes</Button>)

    const button = screen.getByRole('button', { name: 'Save changes' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
