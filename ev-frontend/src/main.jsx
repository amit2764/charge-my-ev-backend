import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { initializeSentry } from './sentry'

// Initialize error tracking
initializeSentry()

function safeReadJson(value) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function readSentryTags() {
  const userId = (localStorage.getItem('user') || '').trim() || null
  const role = (localStorage.getItem('role') || '').trim() || null
  const activeBooking = safeReadJson(localStorage.getItem('activeBooking'))
  const bookingId = activeBooking && activeBooking.id ? String(activeBooking.id) : null
  const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'

  return { userId, role, bookingId, appVersion }
}

Sentry.addGlobalEventProcessor((event) => {
  const { userId, role, bookingId, appVersion } = readSentryTags()
  event.tags = {
    ...(event.tags || {}),
    appVersion,
    ...(userId ? { userId } : {}),
    ...(role ? { role } : {}),
    ...(bookingId ? { bookingId } : {})
  }
  if (userId) {
    event.user = {
      ...(event.user || {}),
      id: userId
    }
  }
  return event
})

window.addEventListener('error', (event) => {
  const { userId, role, bookingId } = readSentryTags()
  Sentry.withScope((scope) => {
    if (userId) scope.setTag('userId', userId)
    if (role) scope.setTag('role', role)
    if (bookingId) scope.setTag('bookingId', bookingId)
    scope.setTag('appVersion', import.meta.env.VITE_APP_VERSION || 'unknown')
    Sentry.captureException(event.error || new Error(event.message || 'Unhandled window error'))
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const { userId, role, bookingId } = readSentryTags()
  Sentry.withScope((scope) => {
    if (userId) scope.setTag('userId', userId)
    if (role) scope.setTag('role', role)
    if (bookingId) scope.setTag('bookingId', bookingId)
    scope.setTag('appVersion', import.meta.env.VITE_APP_VERSION || 'unknown')
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled promise rejection'))
    Sentry.captureException(reason)
  })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
