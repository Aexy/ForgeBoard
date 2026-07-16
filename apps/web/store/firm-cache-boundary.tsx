'use client'

import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { forgeboardApi } from './api'
import type { AppDispatch } from './store'
import type { FirmContext } from '@/lib/firm-context'

const CurrentFirmContext = createContext<FirmContext | undefined>(undefined)

export function FirmContextProvider({ firm, children }: Readonly<{ firm: FirmContext; children: ReactNode }>) {
  return <CurrentFirmContext.Provider value={firm}>{children}</CurrentFirmContext.Provider>
}

export function useFirmContext(): FirmContext {
  const firm = useContext(CurrentFirmContext)
  if (!firm) throw new Error('useFirmContext must be used inside a firm route layout')
  return firm
}

/** Clears all tenant-owned RTK Query data before a new firm route can load. */
export function FirmCacheBoundary({ firmId, children }: Readonly<{ firmId: string; children: ReactNode }>) {
  const dispatch = useDispatch<AppDispatch>()
  const previousFirmId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousFirmId.current && previousFirmId.current !== firmId) {
      dispatch(forgeboardApi.util.resetApiState())
    }
    previousFirmId.current = firmId
  }, [dispatch, firmId])

  return children
}
