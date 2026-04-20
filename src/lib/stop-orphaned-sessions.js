const { stopOrphanedSessions } = require('../jobs/stopOrphanedSessions');
const logger = require('./logger');

const CRON_INTERVAL_MS = Number(process.env.STOP_ORPHANED_SESSIONS_INTERVAL_MS || 15 * 60 * 1000); // 15 minutes

/**
 * Start the cron job for stopping orphaned sessions
 * Runs every 15 minutes (configurable via env var)
 */
function startStopOrphanedSessionsCron() {
  logger.info('Starting stop-orphaned-sessions cron job', {
    interval: `${CRON_INTERVAL_MS / 1000}s`
  });

  // Run immediately on startup
  stopOrphanedSessions().catch(err => {
    logger.error('Initial stopOrphanedSessions run failed', { error: err.message });
  });

  // Then run on interval
  setInterval(() => {
    stopOrphanedSessions().catch(err => {
      logger.error('stopOrphanedSessions interval run failed', { error: err.message });
    });
  }, CRON_INTERVAL_MS);
}

module.exports = {
  startStopOrphanedSessionsCron
};
