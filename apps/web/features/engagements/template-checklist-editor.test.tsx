// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { TemplateChecklistEditor } from './TemplateChecklistEditor'

function Harness() {
  const [items, setItems] = useState([{ label: 'Reconcile', required: true, position: 0 }, { label: 'Send summary', required: false, position: 1 }])
  return <TemplateChecklistEditor items={items} onChange={setItems} />
}

describe('TemplateChecklistEditor', () => {
  it('supports ordered required and optional entries', () => {
    render(<Harness />)
    expect(screen.getAllByRole('checkbox', { name: 'Required' })[0]).toBeChecked()
    fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1])
    expect(screen.getByLabelText('Checklist item 1')).toHaveValue('Send summary')
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(screen.queryByDisplayValue('Send summary')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add checklist item' }))
    expect(screen.getByLabelText('Checklist item 2')).toHaveValue('')
  })
})
