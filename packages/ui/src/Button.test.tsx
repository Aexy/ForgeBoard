// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './Button'
import styles from './Button.module.css'

afterEach(cleanup)

describe('Button', () => {
  it('uses accessible button semantics and remains keyboard-focusable', () => {
    render(<Button>Save changes</Button>)

    const button = screen.getByRole('button', { name: 'Save changes' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass(styles.button, styles.primary)

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

  it('forwards native attributes and refs while retaining shared and consumer classes', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button
        ref={ref}
        type="submit"
        variant="secondary"
        className="consumerClass"
        aria-describedby="button-help"
        data-action="save"
      >
        Save changes
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Save changes' })
    expect(ref.current).toBe(button)
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveAttribute('aria-describedby', 'button-help')
    expect(button).toHaveAttribute('data-action', 'save')
    expect(button).toHaveClass(styles.button, styles.secondary, 'consumerClass')
  })
})
