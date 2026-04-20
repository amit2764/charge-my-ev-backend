const { resolveStuckPayments } = require('../jobs/resolveStuckPayments');
const logger = require('./logger');

const CRON_INTERVAL_MS = Number(process.env.RESOLVE_STUCK_PAYMENTS_INTERVAL_MS || 10 * 60 * 1000); // 10 minutes

/**
 * Start the cron job for resolving stuck payments
 * Runs every 10 minutes (configurable via env var)
 */
function startResolveStuckPaymentsCron() {
  logger.info('Starting resolve-stuck-payments cron job', {
    interval: `${CRON_INTERVAL_MS / 1000}s`
  });

  // Run immediately on startup
  resolveStuckPayments().catch(err => {
    logger.error('Initial resolveStuckPayments run failed', { error: err.message });
  });

  // Then run on interval
  setInterval(() => {
    resolveStuckPayments().catch(err => {
      logger.error('resolveStuckPayments interval run failed', { error: err.message });
    });
  }, CRON_INTERVAL_MS);
}

module.exports = {
  startResolveStuckPaymentsCron
};
