'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'

import { forgeboardApi } from './api'
import type { AppDispatch } from './store'

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
