/**
 * Auto-Close Booking Module
 * Automatically closes (cancels) bookings that haven't been confirmed after 30 minutes
 */

const { db, mockMode } = require('./config/firebase');
const redis = require('./lib/redis');

// Mock storage for tracking bookings
let mockBookings = new Map();

// Auto-close job reference
let autoCloseJob = null;

// Configuration
const CONFIG = {
  MAX_BOOKING_WAIT_MS: 30 * 60 * 1000,  // 30 minutes in milliseconds
  CHECK_INTERVAL_MS: 5 * 60 * 1000       // Check every 5 minutes
};

/**
 * Get all BOOKED bookings from storage
 * @returns {Promise<array>} Array of booking objects with id
 */
async function getBookedBookings() {
  try {
    let bookings = [];

    if (mockMode) {
      // Mock mode: get from in-memory Map
      for (const [id, booking] of mockBookings) {
        if (booking.status === 'BOOKED') {
          bookings.push({ id, ...booking });
        }
      }
    } else {
      // Firestore: query all BOOKED bookings
      const snapshot = await db.collection('bookings')
        .where('status', '==', 'BOOKED')
        .get();

      snapshot.forEach(doc => {
        bookings.push({ id: doc.id, ...doc.data() });
      });
    }

    return bookings;
  } catch (error) {
    console.error('Error getting booked bookings:', error);
    return [];
  }
}

/**
 * Calculate elapsed time since booking was created
 * @param {Date|object} createdAt - The createdAt from booking
 * @returns {number} Elapsed time in minutes
 */
function getElapsedMinutes(createdAt) {
  try {
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const elapsedMs = now - created;
    return elapsedMs / (1000 * 60);
  } catch (error) {
    console.error('Error calculating elapsed time:', error);
    return 0;
  }
}

/**
 * Check if a booking has exceeded the max wait time
 * @param {Date|object} createdAt - The createdAt from booking
 * @returns {boolean} True if booking exceeds max wait time
 */
function hasExceededWaitTime(createdAt) {
  try {
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const elapsedMs = now - created;

    return elapsedMs >= CONFIG.MAX_BOOKING_WAIT_MS;
  } catch (error) {
    console.error('Error checking wait time:', error);
    return false;
  }
}

/**
 * Close (cancel) an expired booking
 * @param {string} bookingId - The booking ID to close
 * @param {object} booking - The booking object
 * @returns {Promise<object>} Result of close operation
 */
async function closeExpiredBooking(bookingId, booking) {
  try {
    console.log(`[AUTO-CLOSE] Closing expired booking ${bookingId}`);
    console.log(`[AUTO-CLOSE] Booking: userId=${booking.userId}, elapsed=${getElapsedMinutes(booking.createdAt).toFixed(1)}min`);

    // Prepare update data
    const updateData = {
      status: 'EXPIRED',
      reason: 'auto_closed_no_confirmation',
      closedAt: new Date(),
      updatedAt: new Date()
    };

    if (mockMode) {
      // Mock mode: update booking
      Object.assign(booking, updateData);
      mockBookings.set(bookingId, booking);
    } else {
      // Firestore: update booking document
      await db.collection('bookings').doc(bookingId).update(updateData);
      booking = { ...booking, ...updateData };
    }

    console.log(`[AUTO-CLOSE] Successfully closed booking ${bookingId}`);
    return {
      success: true,
      bookingId,
      action: 'auto-closed',
      elapsedMinutes: getElapsedMinutes(booking.createdAt),
      closedAt: updateData.closedAt
    };
  } catch (error) {
    console.error(`[AUTO-CLOSE] Error closing booking ${bookingId}:`, error);
    return {
      success: false,
      bookingId,
      action: 'failed',
      error: error.message
    };
  }
}

/**
 * Main auto-close check function
 * Queries all BOOKED bookings and closes those exceeding 30 minutes
 * @returns {Promise<object>} Report of check results
 */
async function runAutoCloseCheck() {
  try {
    const bookings = await getBookedBookings();

    if (bookings.length === 0) {
      return {
        success: true,
        bookingsChecked: 0,
        bookingsClosed: 0,
        results: [],
        timestamp: new Date().toISOString()
      };
    }

    console.log(`[AUTO-CLOSE] Checking ${bookings.length} booked booking(s)...`);

    const results = [];
    let bookingsClosed = 0;

    for (const booking of bookings) {
      if (hasExceededWaitTime(booking.createdAt)) {
        const result = await closeExpiredBooking(booking.id, booking);
        results.push(result);
        if (result.success) {
          bookingsClosed++;
        }
      }
    }

    const report = {
      success: true,
      bookingsChecked: bookings.length,
      bookingsClosed,
      results,
      timestamp: new Date().toISOString()
    };

    console.log(`[AUTO-CLOSE] Report: ${JSON.stringify(report)}`);
    return report;
  } catch (error) {
    console.error('Error running auto-close check:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Start the auto-close background job
 * Uses setInterval to check for expired bookings periodically
 * @returns {object} Job status
 */
function startAutoCloseJob() {
  if (autoCloseJob) {
    console.log('[AUTO-CLOSE] Job already running');
    return {
      status: 'already-running',
      message: 'Auto-close job is already running'
    };
  }

  console.log(`[AUTO-CLOSE] Background job started. Check interval: ${CONFIG.CHECK_INTERVAL_MS}ms (${(CONFIG.CHECK_INTERVAL_MS / 1000 / 60).toFixed(1)}min)`);
  console.log(`[AUTO-CLOSE] Max booking wait time: 30 minutes`);

  autoCloseJob = setInterval(async () => {
    if (redis) {
      const lockKey = 'lock:auto-close-job';
      const lockTtl = Math.floor(CONFIG.CHECK_INTERVAL_MS / 1000) - 5;
      
      const acquired = await redis.set(lockKey, 'locked', 'NX', 'EX', lockTtl);
      if (!acquired) {
        return; // Another server instance is already running this check
      }
    }
    await runAutoCloseCheck();
  }, CONFIG.CHECK_INTERVAL_MS);

  return {
    status: 'started',
    message: 'Auto-close job started successfully'
  };
}

/**
 * Stop the auto-close background job
 * @returns {object} Job status
 */
function stopAutoCloseJob() {
  if (!autoCloseJob) {
    console.log('[AUTO-CLOSE] No job running to stop');
    return {
      status: 'not-running',
      message: 'No auto-close job is currently running'
    };
  }

  clearInterval(autoCloseJob);
  autoCloseJob = null;
  console.log('[AUTO-CLOSE] Background job stopped');

  return {
    status: 'stopped',
    message: 'Auto-close job stopped successfully'
  };
}

/**
 * Get current auto-close job status
 * @returns {object} Current job status and configuration
 */
function getAutoCloseStatus() {
  return {
    isRunning: autoCloseJob !== null,
    checkInterval: CONFIG.CHECK_INTERVAL_MS,
    maxBookingWait: CONFIG.MAX_BOOKING_WAIT_MS,
    maxBookingWaitMinutes: 30,
    config: CONFIG
  };
}

/**
 * Set mock bookings (for testing in mock mode)
 * @param {Map} bookings - Map of bookings
 */
function setMockBookings(bookings) {
  mockBookings = bookings;
}

module.exports = {
  startAutoCloseJob,
  stopAutoCloseJob,
  getAutoCloseStatus,
  runAutoCloseCheck,
  getBookedBookings,
  hasExceededWaitTime,
  getElapsedMinutes,
  setMockBookings,
  CONFIG
};
