/**
 * Auto-Stop Logic Module
 * Automatically stops charging sessions that exceed max duration
 * Enhanced with session manager for comprehensive reliability
 */

const { db, mockMode } = require('./config/firebase');
const { performSessionHealthCheck, SESSION_CONFIG } = require('./session-manager');
const redis = require('./lib/redis');

// Mock storage for tracking started bookings
let mockBookings = new Map();

// Auto-stop job reference (to allow stopping the interval)
let autoStopJob = null;

// Configuration - now uses session manager config
const CONFIG = {
  CHECK_INTERVAL_MS: SESSION_CONFIG.CHECK_INTERVAL_MS,  // Use session manager interval
  MAX_SESSION_DURATION_MS: SESSION_CONFIG.MAX_DURATION_MS,  // Use session manager max duration
  AUTO_STOP_OTP: 'AUTO'                          // Special OTP marker for auto-stop
};

/**
 * Get all STARTED bookings from storage
 * @returns {Promise<array>} Array of booking objects with id
 */
async function getStartedBookings() {
  try {
    let bookings = [];

    if (mockMode) {
      // Mock mode: get from in-memory Map
      for (const [id, booking] of mockBookings) {
        if (booking.status === 'STARTED') {
          bookings.push({ id, ...booking });
        }
      }
    } else {
      // Firestore: query all STARTED bookings
      const snapshot = await db.collection('bookings')
        .where('status', '==', 'STARTED')
        .get();

      snapshot.forEach(doc => {
        bookings.push({ id: doc.id, ...doc.data() });
      });
    }

    return bookings;
  } catch (error) {
    console.error('Error getting started bookings:', error);
    return [];
  }
}

/**
 * Check if a session has exceeded maximum duration
 * @param {Date|object} startTime - The startTime from booking
 * @returns {boolean} True if session exceeds max duration
 */
function hasExceededMaxDuration(startTime) {
  try {
    // Convert Firestore timestamp to Date if necessary
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const now = new Date();
    const elapsedMs = now - start;

    return elapsedMs >= CONFIG.MAX_SESSION_DURATION_MS;
  } catch (error) {
    console.error('Error checking duration:', error);
    return false;
  }
}

/**
 * Calculate elapsed time in hours
 * @param {Date|object} startTime - The startTime from booking
 * @returns {number} Elapsed time in hours
 */
function getElapsedHours(startTime) {
  try {
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const now = new Date();
    const elapsedMs = now - start;
    return elapsedMs / (1000 * 60 * 60);
  } catch (error) {
    console.error('Error calculating elapsed time:', error);
    return 0;
  }
}

/**
 * Auto-stop a booking when max duration is exceeded
 * @param {string} bookingId - The booking ID to stop
 * @param {object} booking - The booking object
 * @returns {Promise<object>} Result of stop operation
 */
async function autoStopBooking(bookingId, booking) {
  try {
    console.log(`[AUTO-STOP] Max duration exceeded for booking ${bookingId}`);
    console.log(`[AUTO-STOP] Booking: userId=${booking.userId}, duration=${getElapsedHours(booking.startTime).toFixed(2)}h`);

    // Use the endOtp to stop (required by stopCharging function)
    const { stopCharging } = require('./booking');
    const result = await stopCharging(bookingId, booking.endOtp);

    if (result.success) {
      console.log(`[AUTO-STOP] Successfully stopped booking ${bookingId}`);
      console.log(`[AUTO-STOP] Final amount: $${result.finalAmount}`);
      return {
        success: true,
        bookingId,
        finalAmount: result.finalAmount,
        action: 'auto-stopped'
      };
    } else {
      console.warn(`[AUTO-STOP] Failed to stop booking ${bookingId}: ${result.error}`);
      return {
        success: false,
        bookingId,
        error: result.error,
        action: 'failed'
      };
    }
  } catch (error) {
    console.error(`[AUTO-STOP] Error auto-stopping booking ${bookingId}:`, error);
    return {
      success: false,
      bookingId,
      error: error.message,
      action: 'error'
    };
  }
}

/**
 * Main auto-stop check function
 * Uses session manager for comprehensive health monitoring
 * @returns {Promise<object>} Report of actions taken
 */
async function runAutoStopCheck() {
  try {
    // Use session manager's comprehensive health check
    const healthReport = await performSessionHealthCheck();

    if (!healthReport.success) {
      console.error('[AUTO-STOP] Health check failed:', healthReport.error);
      return {
        success: false,
        error: healthReport.error,
        timestamp: new Date().toISOString()
      };
    }

    // Log health check results only if there's something to report
    if (healthReport.activeSessions > 0 || healthReport.sessionsNeedingStop > 0 || healthReport.warningsSent > 0) {
      console.log(`[AUTO-STOP] Health check: ${healthReport.activeSessions} active, ${healthReport.sessionsNeedingStop} need stop, ${healthReport.warningsSent} warnings sent`);
    }

    // Additional legacy check for bookings that might not be in session states
    const bookings = await getStartedBookings();
    const legacyResults = [];

    for (const booking of bookings) {
      if (hasExceededMaxDuration(booking.startTime)) {
        const result = await autoStopBooking(booking.id, booking);
        legacyResults.push(result);
      }
    }

    const report = {
      success: true,
      healthReport,
      legacyBookingsChecked: bookings.length,
      legacyBookingsStopped: legacyResults.filter(r => r.success).length,
      legacyResults: legacyResults,
      timestamp: new Date().toISOString()
    };

    if (legacyResults.length > 0) {
      console.log(`[AUTO-STOP] Legacy report: ${JSON.stringify(report)}`);
    }

    return report;
  } catch (error) {
    console.error('[AUTO-STOP] Error in auto-stop check:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Start the auto-stop background job
 * Runs periodically to check and stop sessions exceeding 4 hours
 * @returns {object} Status of started job
 */
function startAutoStopJob() {
  try {
    if (autoStopJob) {
      console.log('[AUTO-STOP] Job already running');
      return {
        success: true,
        status: 'already-running',
        message: 'Auto-stop job already running'
      };
    }

    // Create recurring job with setInterval
    autoStopJob = setInterval(async () => {
      // If Redis is available, use a distributed lock to prevent horizontal scaling collisions
      if (redis) {
        const lockKey = 'lock:auto-stop-job';
        const lockTtl = Math.floor(CONFIG.CHECK_INTERVAL_MS / 1000) - 5; // Lock expires slightly before next run
        
        const acquired = await redis.set(lockKey, 'locked', 'NX', 'EX', lockTtl);
        if (!acquired) {
          return; // Another server instance is currently processing this job
        }
      }
      
      await runAutoStopCheck();
    }, CONFIG.CHECK_INTERVAL_MS);

    console.log(`[AUTO-STOP] Background job started. Check interval: ${CONFIG.CHECK_INTERVAL_MS}ms (${CONFIG.CHECK_INTERVAL_MS / 1000}s)`);
    console.log(`[AUTO-STOP] Max session duration: ${CONFIG.MAX_SESSION_DURATION_MS / 1000 / 60 / 60} hours`);

    return {
      success: true,
      status: 'started',
      checkInterval: CONFIG.CHECK_INTERVAL_MS,
      maxSessionDuration: CONFIG.MAX_SESSION_DURATION_MS,
      message: 'Auto-stop job started successfully'
    };
  } catch (error) {
    console.error('[AUTO-STOP] Error starting auto-stop job:', error);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Stop the auto-stop background job
 * @returns {object} Status of stopped job
 */
function stopAutoStopJob() {
  try {
    if (!autoStopJob) {
      console.log('[AUTO-STOP] No job running to stop');
      return {
        success: true,
        status: 'not-running',
        message: 'No auto-stop job was running'
      };
    }

    // Clear the interval to stop the recurring job
    clearInterval(autoStopJob);
    autoStopJob = null;

    console.log('[AUTO-STOP] Background job stopped');

    return {
      success: true,
      status: 'stopped',
      message: 'Auto-stop job stopped successfully'
    };
  } catch (error) {
    console.error('[AUTO-STOP] Error stopping auto-stop job:', error);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get current auto-stop job status
 * @returns {object} Status information
 */
function getAutoStopStatus() {
  return {
    isRunning: autoStopJob !== null,
    checkInterval: CONFIG.CHECK_INTERVAL_MS,
    maxSessionDuration: CONFIG.MAX_SESSION_DURATION_MS,
    maxSessionDurationHours: CONFIG.MAX_SESSION_DURATION_MS / (1000 * 60 * 60),
    sessionConfig: SESSION_CONFIG,
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
  startAutoStopJob,
  stopAutoStopJob,
  getAutoStopStatus,
  runAutoStopCheck,
  getStartedBookings,
  hasExceededMaxDuration,
  getElapsedHours,
  setMockBookings,
  CONFIG
};