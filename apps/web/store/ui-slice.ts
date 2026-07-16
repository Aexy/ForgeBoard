import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Notification {
  id: string
  message: string
  tone: 'info' | 'success' | 'warning' | 'error'
}

export interface UiState {
  mobileNavigationOpen: boolean
  notifications: Notification[]
}

const initialState: UiState = { mobileNavigationOpen: false, notifications: [] }

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setMobileNavigationOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavigationOpen = action.payload
    },
    addNotification(state, action: PayloadAction<Notification>) {
      state.notifications.push(action.payload)
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter((notification) => notification.id !== action.payload)
    },
  },
})

export const { addNotification, dismissNotification, setMobileNavigationOpen } = uiSlice.actions
export const uiReducer = uiSlice.reducer
