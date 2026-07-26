// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { ReviewReturnDialog } from './ReviewReturnDialog'
import { LanguageProvider } from '@/app/LanguageProvider'

describe('ReviewReturnDialog', () => {
  afterEach(cleanup)
  beforeEach(() => { HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') }); HTMLDialogElement.prototype.close = vi.fn() })
  it('requires a nonblank return note and restores the invoking focus on cancel', () => {
    const onCancel = vi.fn(); const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
    render(<LanguageProvider initialLanguage="en"><ReviewReturnDialog onCancel={onCancel} onConfirm={vi.fn()} /></LanguageProvider>)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Return for preparation')
    expect(screen.getByRole('button', { name: 'Return work' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce(); expect(trigger).toHaveFocus(); document.body.removeChild(trigger)
  })
  it('submits a trimmed note only when supplied', () => {
    const onConfirm = vi.fn(); render(<LanguageProvider initialLanguage="en"><ReviewReturnDialog onCancel={vi.fn()} onConfirm={onConfirm} /></LanguageProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Review note' }), { target: { value: '  Reconcile VAT  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Return work' }))
    expect(onConfirm).toHaveBeenCalledWith('Reconcile VAT')
  })
})
