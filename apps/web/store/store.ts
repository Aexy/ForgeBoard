import { configureStore } from '@reduxjs/toolkit'

import { forgeboardApi } from './api'

export function makeStore() {
  return configureStore({
    reducer: {
      [forgeboardApi.reducerPath]: forgeboardApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(forgeboardApi.middleware),
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
