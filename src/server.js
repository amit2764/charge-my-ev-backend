const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const Sentry = require('@sentry/node');
const logger = require('./lib/logger');
const { initializeWebSocketServer } = require('./realtime');
const { startPaymentRecoveryCron } = require('./lib/payment-recovery');
const { startResolveStuckPaymentsCron } = require('./lib/resolve-stuck-payments');
const { startStopOrphanedSessionsCron } = require('./lib/stop-orphaned-sessions');
const packageJson = require('../package.json');

// Module route registrations
const authModule = require('./modules/auth');
const requestModule = require('./modules/request');
const matchingModule = require('./modules/matching');
const bookingModule = require('./modules/booking');
const sessionModule = require('./modules/session');
const paymentModule = require('./modules/payment');
const trustModule = require('./modules/trust');
const notificationsModule = require('./modules/notifications');
const adminModule = require('./modules/admin');
const ratingModule = require('./modules/rating');
const moderationModule = require('./modules/moderation');
const kycModule = require('./modules/kyc');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';
const appVersion = process.env.APP_VERSION || packageJson.version || 'unknown';

function sanitizePayload(input) {
  if (Array.isArray(input)) {
    return input.map(sanitizePayload);
  }
  if (!input || typeof input !== 'object') {
    return input;
  }

  const redacted = {};
  Object.entries(input).forEach(([key, value]) => {
    const lowered = String(key || '').toLowerCase();
    if (lowered.includes('password') || lowered.includes('pin')) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = sanitizePayload(value);
    }
  });
  return redacted;
}

function readRequestContext(req) {
  const body = req && req.body && typeof req.body === 'object' ? req.body : {};
  const query = req && req.query && typeof req.query === 'object' ? req.query : {};
  const params = req && req.params && typeof req.params === 'object' ? req.params : {};

  const userId = body.userId || body.fromUserId || query.userId || params.userId || null;
  const role = body.role || query.role || params.role || null;
  const bookingId = body.bookingId || params.bookingId || params.id || query.bookingId || null;

  return {
    userId: userId ? String(userId) : null,
    role: role ? String(role) : null,
    bookingId: bookingId ? String(bookingId) : null
  };
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV || 'development',
  release: `ev-charging-backend@${appVersion}`,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event, hint) {
    const req = hint && hint.originalException && hint.originalException.req;
    if (req) {
      event.request = event.request || {};
      event.request.data = sanitizePayload(req.body || {});
    }
    event.tags = {
      ...(event.tags || {}),
      appVersion
    };
    return event;
  }
});

const corsOptions = {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(Sentry.Handlers.requestHandler());
app.use(bodyParser.json());

app.use((req, res, next) => {
  const context = readRequestContext(req);
  Sentry.configureScope((scope) => {
    scope.setTag('appVersion', appVersion);
    if (context.userId) {
      scope.setTag('userId', context.userId);
      scope.setUser({ id: context.userId });
    }
    if (context.role) {
      scope.setTag('role', context.role);
    }
    if (context.bookingId) {
      scope.setTag('bookingId', context.bookingId);
    }
    scope.setContext('request', {
      method: req.method,
      path: req.path,
      params: req.params || {},
      query: req.query || {},
      body: sanitizePayload(req.body || {})
    });
  });
  next();
});

// Basic health
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Register module routes
if (authModule.registerRoutes) authModule.registerRoutes(app);
if (requestModule.registerRoutes) requestModule.registerRoutes(app);
if (matchingModule.registerRoutes) matchingModule.registerRoutes(app);
if (bookingModule.registerRoutes) bookingModule.registerRoutes(app);
if (sessionModule.registerRoutes) sessionModule.registerRoutes(app);
if (paymentModule.registerRoutes) paymentModule.registerRoutes(app);
if (trustModule.registerRoutes) trustModule.registerRoutes(app);
if (notificationsModule.registerRoutes) notificationsModule.registerRoutes(app);
if (adminModule.registerRoutes) adminModule.registerRoutes(app);
if (ratingModule.registerRoutes) ratingModule.registerRoutes(app);
if (moderationModule.registerRoutes) moderationModule.registerRoutes(app);
if (kycModule.registerRoutes) kycModule.registerRoutes(app);

// Error handler
app.use(Sentry.Handlers.errorHandler());
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: 'Internal Server Error' });
});

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
  logger.error('Unhandled rejection', { reason: reason && reason.message ? reason.message : String(reason) });
});

process.on('uncaughtException', (error) => {
  Sentry.captureException(error);
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
});

const server = http.createServer(app);
initializeWebSocketServer(server, {
  path: '/ws',
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

startPaymentRecoveryCron();
startStopOrphanedSessionsCron();
startResolveStuckPaymentsCron();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});

module.exports = { app, server };
