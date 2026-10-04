'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { setupListeners } from '@reduxjs/toolkit/query'
import { Provider } from 'react-redux'

import { makeStore, type AppStore } from './store'

export function StoreProvider({ children }: Readonly<{ children: ReactNode }>) {
  const storeRef = useRef<AppStore | null>(null)
  if (!storeRef.current) storeRef.current = makeStore()

  useEffect(() => setupListeners(storeRef.current!.dispatch), [])

  return <Provider store={storeRef.current}>{children}</Provider>
}
