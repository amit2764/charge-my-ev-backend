import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

/**
 * Initialize Sentry for error tracking and performance monitoring
 * This is configured for production use only
 */
export function initializeSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENVIRONMENT || 'development';

  // Only initialize if DSN is provided
  if (!sentryDsn) {
    console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  console.log(`Initializing Sentry for ${environment}...`);

  Sentry.init({
    dsn: sentryDsn,
    environment: environment,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay(),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    // Additional context
    maxBreadcrumbs: 50,
    attachStacktrace: true,
  });

  console.log('✓ Sentry initialized successfully');
}

/**
 * Capture exceptions manually if needed
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, { contexts: { custom: context } });
}

/**
 * Capture messages for non-error events
 */
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId, email, phone) {
  Sentry.setUser({
    id: userId,
    email: email,
    username: phone,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

export default Sentry;
