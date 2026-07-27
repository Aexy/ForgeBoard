// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'

import { AppShell } from './AppShell'
import styles from './AppShell.module.css'

afterEach(cleanup)

describe('AppShell', () => {
  it('provides one main landmark without imposing a firm-specific navigation name', () => {
    render(
      <AppShell navigation={<nav aria-label="Platform administration"><a href="/platform-admin">Overview</a></nav>}>
        <h1>Platform administration</h1>
      </AppShell>,
    )

    const complementary = screen.getByRole('complementary')
    expect(complementary).not.toHaveAccessibleName()
    expect(complementary).toHaveClass(styles.navigation)
    expect(within(complementary).getByRole('navigation', { name: 'Platform administration' })).toBeVisible()

    const main = screen.getByRole('main')
    expect(main).toHaveClass(styles.content)
    expect(within(main).getByRole('heading', { name: 'Platform administration' })).toBeVisible()
  })
})
