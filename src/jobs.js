const { Queue } = require('bullmq');
const redisClient = require('./lib/redis');
const { sendReceiptEmail } = require('./email');

let emailQueue;

const redisUrl =
  process.env.REDIS_URL ||
  process.env.REDIS_PRIVATE_URL ||
  process.env.REDIS_PUBLIC_URL ||
  process.env.RAILWAY_REDIS_URL ||
  '';
const isPlaceholder =
  redisUrl.includes('your_upstash_endpoint') ||
  redisUrl.includes('YOUR_ACTUAL_PASSWORD') ||
  redisUrl.includes('YOUR_ENDPOINT') ||
  redisUrl.endsWith('PORT');
const isValidScheme = /^rediss?:\/\//i.test(redisUrl);
const isInvalidUrl = !redisUrl || isPlaceholder || !isValidScheme;

// Check if Redis URL is configured and valid before creating the queue
if (!isInvalidUrl) {
  try {
    // BullMQ uses connection object
    emailQueue = new Queue('email-jobs', {
      connection: redisUrl
    });

    // Crucial: Catch connection errors to prevent the entire app from crashing
    emailQueue.on('error', (err) => {
      console.error('⚠️ Background Job Queue Error:', err.message);
    });
  } catch (error) {
    console.error('⚠️ Failed to initialize Job Queue (Invalid REDIS_URL format):', error.message);
    emailQueue = null; // Fallback to running without the queue
  }
} else {
  console.warn('⚠️ BullMQ Queue disabled: Redis URL is not configured (REDIS_URL/REDIS_PRIVATE_URL/REDIS_PUBLIC_URL).');
}

function initializeWorkers() {
  if (!emailQueue) return;

  console.log('--- Initializing Background Job Workers ---');

  // Process jobs from the email queue
  emailQueue.process(async (job) => {
    const { toEmail, bookingDetails } = job.data;
    console.log(`[WORKER] Processing email job for ${toEmail}`);
    await sendReceiptEmail(toEmail, bookingDetails);
  });

  console.log('--- Background Job Workers Ready ---');
}

module.exports = {
  emailQueue,
  initializeWorkers
};