const cron = require('node-cron');
const logger = require('../lib/logger');
const { resolveStuckPayments } = require('./resolveStuckPayments');
const { stopOrphanedSessions } = require('./stopOrphanedSessions');

let started = false;

function registerCronJobs() {
  if (started) return;
  started = true;

  logger.info('Registering cron jobs with node-cron', { schedule: '*/10 * * * *' });

  cron.schedule('*/10 * * * *', async () => {
    try {
      const resolvedCount = await resolveStuckPayments();
      logger.info('cron.resolveStuckPayments completed', { resolvedCount });
    } catch (error) {
      logger.error('cron.resolveStuckPayments failed', { error: error.message });
    }
  });

  cron.schedule('*/10 * * * *', async () => {
    try {
      const resolvedCount = await stopOrphanedSessions();
      logger.info('cron.stopOrphanedSessions completed', { resolvedCount });
    } catch (error) {
      logger.error('cron.stopOrphanedSessions failed', { error: error.message });
    }
  });
}

module.exports = {
  registerCronJobs
};
