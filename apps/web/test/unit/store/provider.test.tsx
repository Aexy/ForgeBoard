// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { setupListeners } from '@reduxjs/toolkit/query'
import { StoreProvider } from '@/store/provider'

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn() }))
vi.mock('@reduxjs/toolkit/query', async (importOriginal) => ({
  ...await importOriginal<typeof import('@reduxjs/toolkit/query')>(),
  setupListeners: vi.fn(() => mocks.unsubscribe),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('installs listeners once per mounted provider and disposes them on unmount', () => {
  const view = render(<StoreProvider><span>First</span></StoreProvider>)
  expect(setupListeners).toHaveBeenCalledOnce()
  expect(setupListeners).toHaveBeenCalledWith(expect.any(Function))
  view.rerender(<StoreProvider><span>Updated</span></StoreProvider>)
  expect(setupListeners).toHaveBeenCalledOnce()
  expect(mocks.unsubscribe).not.toHaveBeenCalled()
  view.unmount()
  expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  const remounted = render(<StoreProvider><span>New mount</span></StoreProvider>)
  expect(setupListeners).toHaveBeenCalledTimes(2)
  expect(vi.mocked(setupListeners).mock.calls[1][0]).not.toBe(vi.mocked(setupListeners).mock.calls[0][0])
  remounted.unmount()
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(2)
})
