/**
 * Session Reliability Manager
 * Hardens OTP-based charging sessions against edge cases and tampering
 */

const { db, mockMode } = require('./config/firebase');
const { stopCharging } = require('./booking');
const { notifyOTPRequired, notifySessionStarted, notifySessionStopped } = require('./notifications');
const { trackSessionIssue } = require('./monitoring');

// Mock storage for session state
let mockSessionStates = new Map();

// Session configuration
const SESSION_CONFIG = {
  MAX_DURATION_HOURS: 8,                    // Maximum session duration
  MAX_DURATION_MS: 8 * 60 * 60 * 1000,      // 8 hours in milliseconds
  OTP_VALIDITY_MINUTES: 15,                 // OTP valid for 15 minutes after generation
  SESSION_LOCK_TIMEOUT_MS: 5 * 60 * 1000,   // 5 minutes lock timeout
  CHECK_INTERVAL_MS: 30 * 1000,             // Check every 30 seconds
  GRACE_PERIOD_MS: 10 * 60 * 1000,          // 10 minutes grace period for auto-stop warnings
  MAX_CONCURRENT_SESSIONS_PER_USER: 1,      // Max concurrent sessions per user
  MAX_CONCURRENT_SESSIONS_PER_CHARGER: 1,   // Max concurrent sessions per charger
};

// Session states for tracking
const SESSION_STATES = {
  CREATED: 'CREATED',       // Booking created, not started
  STARTING: 'STARTING',     // Start OTP entered, processing
  ACTIVE: 'ACTIVE',         // Charging actively running
  STOPPING: 'STOPPING',     // Stop OTP entered, processing
  COMPLETED: 'COMPLETED',   // Successfully completed
  AUTO_STOPPED: 'AUTO_STOPPED', // Auto-stopped due to timeout
  ERROR: 'ERROR'            // Error state
};

// In-memory locks to prevent concurrent operations
const sessionLocks = new Map();

/**
 * Acquire a lock for session operations
 * @param {string} bookingId - Booking ID
 * @returns {boolean} True if lock acquired
 */
function acquireSessionLock(bookingId) {
  const lockKey = `session_${bookingId}`;
  const now = Date.now();

  if (sessionLocks.has(lockKey)) {
    const lockTime = sessionLocks.get(lockKey);
    // Check if lock has expired
    if (now - lockTime > SESSION_CONFIG.SESSION_LOCK_TIMEOUT_MS) {
      sessionLocks.delete(lockKey);
    } else {
      return false; // Lock still active
    }
  }

  sessionLocks.set(lockKey, now);
  return true;
}

/**
 * Release a session lock
 * @param {string} bookingId - Booking ID
 */
function releaseSessionLock(bookingId) {
  const lockKey = `session_${bookingId}`;
  sessionLocks.delete(lockKey);
}

/**
 * Validate session state transitions
 * @param {string} currentState - Current session state
 * @param {string} newState - Desired new state
 * @returns {boolean} True if transition is valid
 */
function isValidStateTransition(currentState, newState) {
  const validTransitions = {
    [SESSION_STATES.CREATED]: [SESSION_STATES.STARTING],
    [SESSION_STATES.STARTING]: [SESSION_STATES.ACTIVE, SESSION_STATES.ERROR],
    [SESSION_STATES.ACTIVE]: [SESSION_STATES.STOPPING, SESSION_STATES.AUTO_STOPPED],
    [SESSION_STATES.STOPPING]: [SESSION_STATES.COMPLETED, SESSION_STATES.ERROR],
    [SESSION_STATES.AUTO_STOPPED]: [], // Terminal state
    [SESSION_STATES.COMPLETED]: [],     // Terminal state
    [SESSION_STATES.ERROR]: []          // Terminal state
  };

  return validTransitions[currentState]?.includes(newState) || false;
}

/**
 * Get current session state
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} Session state information
 */
async function getSessionState(bookingId) {
  try {
    if (mockMode) {
      return mockSessionStates.get(bookingId) || {
        bookingId,
        state: SESSION_STATES.CREATED,
        createdAt: new Date(),
        lastUpdated: new Date()
      };
    } else {
      const doc = await db.collection('session_states').doc(bookingId).get();
      if (doc.exists) {
        return { bookingId, ...doc.data() };
      }

      // Create initial state if not exists
      const initialState = {
        bookingId,
        state: SESSION_STATES.CREATED,
        createdAt: new Date(),
        lastUpdated: new Date(),
        otpGeneratedAt: null,
        startTime: null,
        endTime: null,
        warningsSent: [],
        lockAcquiredAt: null
      };

      await db.collection('session_states').doc(bookingId).set(initialState);
      return initialState;
    }
  } catch (error) {
    console.error('Error getting session state:', error);
    // Track session state retrieval error
    await trackSessionIssue(bookingId, 'unknown', 'STATE_RETRIEVAL_ERROR', error.message);
    return {
      bookingId,
      state: SESSION_STATES.ERROR,
      error: error.message
    };
  }
}

/**
 * Update session state with validation
 * @param {string} bookingId - Booking ID
 * @param {string} newState - New state
 * @param {object} additionalData - Additional state data
 * @returns {Promise<object>} Update result
 */
async function updateSessionState(bookingId, newState, additionalData = {}) {
  try {
    // Acquire lock
    if (!acquireSessionLock(bookingId)) {
      return {
        success: false,
        error: 'Session is currently being modified by another operation'
      };
    }

    // Get current state
    const currentState = await getSessionState(bookingId);

    // Validate state transition
    if (newState && !isValidStateTransition(currentState.state, newState)) {
      releaseSessionLock(bookingId);
      return {
        success: false,
        error: `Invalid state transition from ${currentState.state} to ${newState}`
      };
    }

    // Update state
    const updatedState = {
      ...currentState,
      ...(newState && { state: newState }),
      lastUpdated: new Date(),
      ...additionalData
    };

    if (mockMode) {
      mockSessionStates.set(bookingId, updatedState);
    } else {
      await db.collection('session_states').doc(bookingId).update(updatedState);
    }

    releaseSessionLock(bookingId);

    console.log(`[SESSION] ${bookingId}: ${currentState.state} → ${newState}`);
    return { success: true, previousState: currentState.state, newState };

  } catch (error) {
    releaseSessionLock(bookingId);
    console.error('Error updating session state:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate and store OTPs for a booking
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} OTP generation result
 */
async function generateSessionOTPs(bookingId) {
  try {
    const startOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const endOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const generatedAt = new Date();

    console.log(`[SESSION] Generating OTPs for ${bookingId}: start=${startOtp}, end=${endOtp}`);

    // Store OTPs securely (in production, consider encryption)
    const otpData = {
      startOtp,
      endOtp,
      generatedAt,
      expiresAt: new Date(generatedAt.getTime() + SESSION_CONFIG.OTP_VALIDITY_MINUTES * 60 * 1000)
    };

    await updateSessionState(bookingId, null, {
      otpData,
      otpGeneratedAt: generatedAt
    });

    console.log(`[SESSION] OTPs stored for ${bookingId}`);

    return {
      success: true,
      startOtp,
      endOtp,
      expiresAt: otpData.expiresAt
    };

  } catch (error) {
    console.error('Error generating session OTPs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate OTP with expiry checking
 * @param {string} bookingId - Booking ID
 * @param {string} otp - OTP to validate
 * @param {string} type - 'start' or 'end'
 * @returns {Promise<object>} Validation result
 */
async function validateSessionOTP(bookingId, otp, type) {
  try {
    const sessionState = await getSessionState(bookingId);
    console.log(`[SESSION] Validating ${type} OTP for ${bookingId}, sessionState:`, sessionState);

    if (!sessionState.otpData) {
      console.log(`[SESSION] No otpData found for ${bookingId}`);
      return { success: false, error: 'No OTPs generated for this session' };
    }

    const { otpData } = sessionState;
    const now = new Date();

    // Check expiry
    if (now > otpData.expiresAt) {
      return {
        success: false,
        error: 'OTP has expired',
        expired: true,
        expiresAt: otpData.expiresAt
      };
    }

    // Validate OTP
    const expectedOtp = type === 'start' ? otpData.startOtp : otpData.endOtp;
    if (otp !== expectedOtp) {
      return { success: false, error: 'Invalid OTP' };
    }

    return { success: true };

  } catch (error) {
    console.error('Error validating session OTP:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for concurrent session violations
 * @param {string} userId - User ID
 * @param {string} chargerId - Charger ID (optional)
 * @returns {Promise<object>} Validation result
 */
async function checkConcurrentSessionViolations(userId, chargerId = null) {
  try {
    let activeSessions = [];

    if (mockMode) {
      // Check mock storage
      for (const [bookingId, state] of mockSessionStates) {
        if ((state.userId === userId || state.chargerId === chargerId) &&
            [SESSION_STATES.STARTING, SESSION_STATES.ACTIVE].includes(state.state)) {
          activeSessions.push({ bookingId, ...state });
        }
      }
    } else {
      // Check Firestore
      const userSessions = await db.collection('session_states')
        .where('userId', '==', userId)
        .where('state', 'in', [SESSION_STATES.STARTING, SESSION_STATES.ACTIVE])
        .get();

      userSessions.forEach(doc => {
        activeSessions.push({ bookingId: doc.id, ...doc.data() });
      });

      if (chargerId) {
        const chargerSessions = await db.collection('session_states')
          .where('chargerId', '==', chargerId)
          .where('state', 'in', [SESSION_STATES.STARTING, SESSION_STATES.ACTIVE])
          .get();

        chargerSessions.forEach(doc => {
          if (!activeSessions.find(s => s.bookingId === doc.id)) {
            activeSessions.push({ bookingId: doc.id, ...doc.data() });
          }
        });
      }
    }

    // Check limits
    const userSessions = activeSessions.filter(s => s.userId === userId);
    const chargerSessions = chargerId ? activeSessions.filter(s => s.chargerId === chargerId) : [];

    if (userSessions.length >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS_PER_USER) {
      return {
        success: false,
        error: `User already has ${userSessions.length} active session(s). Maximum allowed: ${SESSION_CONFIG.MAX_CONCURRENT_SESSIONS_PER_USER}`,
        violation: 'user_limit'
      };
    }

    if (chargerSessions.length >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS_PER_CHARGER) {
      return {
        success: false,
        error: `Charger already has ${chargerSessions.length} active session(s). Maximum allowed: ${SESSION_CONFIG.MAX_CONCURRENT_SESSIONS_PER_CHARGER}`,
        violation: 'charger_limit'
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Error checking concurrent sessions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start a charging session with full validation
 * @param {string} bookingId - Booking ID
 * @param {string} otp - Start OTP
 * @param {object} booking - Booking data
 * @returns {Promise<object>} Start result
 */
async function startChargingSession(bookingId, otp, booking) {
  try {
    // Validate OTP
    const otpValidation = await validateSessionOTP(bookingId, otp, 'start');
    if (!otpValidation.success) {
      if (otpValidation.expired) {
        // Generate new OTPs and notify user
        const newOtps = await generateSessionOTPs(bookingId);
        if (newOtps.success) {
          await notifyOTPRequired(bookingId, booking.userId, 'start');
        }
      }
      return otpValidation;
    }

    // Check for concurrent session violations
    const concurrentCheck = await checkConcurrentSessionViolations(booking.userId, booking.chargerId);
    if (!concurrentCheck.success) {
      return concurrentCheck;
    }

    // Update session state
    const stateUpdate = await updateSessionState(bookingId, SESSION_STATES.STARTING);
    if (!stateUpdate.success) {
      return stateUpdate;
    }

    // Proceed with charging start (this would call the existing startCharging function)
    // For now, just update state to ACTIVE
    await updateSessionState(bookingId, SESSION_STATES.ACTIVE, {
      startTime: new Date()
    });

    // Notify user
    await notifySessionStarted(bookingId, booking.userId, new Date());

    return {
      success: true,
      message: 'Charging session started successfully',
      startTime: new Date()
    };

  } catch (error) {
    console.error('Error starting charging session:', error);
    await updateSessionState(bookingId, SESSION_STATES.ERROR, { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Stop a charging session with full validation
 * @param {string} bookingId - Booking ID
 * @param {string} otp - Stop OTP
 * @param {object} booking - Booking data
 * @returns {Promise<object>} Stop result
 */
async function stopChargingSession(bookingId, otp, booking) {
  try {
    // Validate OTP
    const otpValidation = await validateSessionOTP(bookingId, otp, 'end');
    if (!otpValidation.success) {
      if (otpValidation.expired) {
        // Generate new OTPs and notify user
        const newOtps = await generateSessionOTPs(bookingId);
        if (newOtps.success) {
          await notifyOTPRequired(bookingId, booking.userId, 'stop');
        }
      }
      return otpValidation;
    }

    // Update session state
    const stateUpdate = await updateSessionState(bookingId, SESSION_STATES.STOPPING);
    if (!stateUpdate.success) {
      return stateUpdate;
    }

    // Proceed with charging stop (this would call the existing stopCharging function)
    // For now, just update state to COMPLETED
    const endTime = new Date();
    await updateSessionState(bookingId, SESSION_STATES.COMPLETED, {
      endTime
    });

    // Notify user
    await notifySessionStopped(bookingId, booking.userId, {
      finalAmount: booking.price * 2, // Placeholder calculation
      duration: 120, // minutes
      endTime
    });

    return {
      success: true,
      message: 'Charging session stopped successfully',
      endTime
    };

  } catch (error) {
    console.error('Error stopping charging session:', error);
    await updateSessionState(bookingId, SESSION_STATES.ERROR, { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Check for sessions that need auto-stop
 * @returns {Promise<array>} Array of sessions to auto-stop
 */
async function getSessionsForAutoStop() {
  try {
    const now = new Date();
    let sessionsToStop = [];

    if (mockMode) {
      for (const [bookingId, state] of mockSessionStates) {
        if (state.state === SESSION_STATES.ACTIVE && state.startTime) {
          const elapsed = now - new Date(state.startTime);
          if (elapsed > SESSION_CONFIG.MAX_DURATION_MS) {
            sessionsToStop.push({ bookingId, ...state });
          }
        }
      }
    } else {
      const activeSessions = await db.collection('session_states')
        .where('state', '==', SESSION_STATES.ACTIVE)
        .get();

      activeSessions.forEach(doc => {
        const data = doc.data();
        if (data.startTime) {
          const startTime = data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime);
          const elapsed = now - startTime;
          if (elapsed > SESSION_CONFIG.MAX_DURATION_MS) {
            sessionsToStop.push({ bookingId: doc.id, ...data });
          }
        }
      });
    }

    return sessionsToStop;

  } catch (error) {
    console.error('Error getting sessions for auto-stop:', error);
    return [];
  }
}

/**
 * Send warning notifications for sessions approaching max duration
 * @returns {Promise<object>} Warning report
 */
async function sendDurationWarnings() {
  try {
    const now = new Date();
    const warningThreshold = SESSION_CONFIG.MAX_DURATION_MS - SESSION_CONFIG.GRACE_PERIOD_MS;
    let warningsSent = 0;

    if (mockMode) {
      for (const [bookingId, state] of mockSessionStates) {
        if (state.state === SESSION_STATES.ACTIVE && state.startTime) {
          const elapsed = now - new Date(state.startTime);
          if (elapsed > warningThreshold && !state.warningsSent?.includes('duration_warning')) {
            // Send warning notification
            console.log(`[WARNING] Session ${bookingId} approaching max duration`);
            warningsSent++;

            // Update warnings sent
            state.warningsSent = state.warningsSent || [];
            state.warningsSent.push('duration_warning');
            mockSessionStates.set(bookingId, state);
          }
        }
      }
    } else {
      // Similar logic for Firestore
      const activeSessions = await db.collection('session_states')
        .where('state', '==', SESSION_STATES.ACTIVE)
        .get();

      for (const doc of activeSessions.docs) {
        const data = doc.data();
        if (data.startTime) {
          const startTime = data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime);
          const elapsed = now - startTime;
          if (elapsed > warningThreshold && !data.warningsSent?.includes('duration_warning')) {
            // Send warning notification to user
            await notifyOTPRequired(doc.id, data.userId, 'extend');
            warningsSent++;

            // Update warnings sent
            await db.collection('session_states').doc(doc.id).update({
              warningsSent: [...(data.warningsSent || []), 'duration_warning']
            });
          }
        }
      }
    }

    return { success: true, warningsSent };

  } catch (error) {
    console.error('Error sending duration warnings:', error);
    return { success: false, error: error.message, warningsSent: 0 };
  }
}

/**
 * Comprehensive session health check
 * @returns {Promise<object>} Health report
 */
async function performSessionHealthCheck() {
  try {
    const report = {
      timestamp: new Date().toISOString(),
      activeSessions: 0,
      sessionsNeedingStop: 0,
      warningsSent: 0,
      locksActive: sessionLocks.size,
      errors: []
    };

    // Check active sessions
    if (mockMode) {
      for (const [bookingId, state] of mockSessionStates) {
        if ([SESSION_STATES.STARTING, SESSION_STATES.ACTIVE, SESSION_STATES.STOPPING].includes(state.state)) {
          report.activeSessions++;
        }
      }
    } else {
      const activeSessions = await db.collection('session_states')
        .where('state', 'in', [SESSION_STATES.STARTING, SESSION_STATES.ACTIVE, SESSION_STATES.STOPPING])
        .get();
      report.activeSessions = activeSessions.size;
    }

    // Check sessions needing auto-stop
    const sessionsToStop = await getSessionsForAutoStop();
    report.sessionsNeedingStop = sessionsToStop.length;

    // Send warnings
    const warningResult = await sendDurationWarnings();
    report.warningsSent = warningResult.warningsSent;

    if (!warningResult.success) {
      report.errors.push(`Warning send failed: ${warningResult.error}`);
    }

    // Auto-stop sessions if needed
    for (const session of sessionsToStop) {
      try {
        await updateSessionState(session.bookingId, SESSION_STATES.AUTO_STOPPED, {
          autoStoppedAt: new Date(),
          reason: 'max_duration_exceeded'
        });
        console.log(`[AUTO-STOP] Session ${session.bookingId} auto-stopped`);
        
        // Track auto-stop as session issue
        await trackSessionIssue(session.bookingId, session.userId || 'unknown', 'AUTO_STOPPED', 'Session exceeded maximum duration', {
          startTime: session.startTime,
          duration: SESSION_CONFIG.MAX_DURATION_HOURS,
          reason: 'max_duration_exceeded'
        });
      } catch (error) {
        report.errors.push(`Auto-stop failed for ${session.bookingId}: ${error.message}`);
        // Track auto-stop failure
        await trackSessionIssue(session.bookingId, session.userId || 'unknown', 'AUTO_STOP_FAILED', error.message);
      }
    }

    return report;

  } catch (error) {
    console.error('Error in session health check:', error);
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      activeSessions: 0,
      sessionsNeedingStop: 0,
      warningsSent: 0
    };
  }
}

module.exports = {
  startChargingSession,
  stopChargingSession,
  generateSessionOTPs,
  validateSessionOTP,
  updateSessionState,
  getSessionState,
  checkConcurrentSessionViolations,
  getSessionsForAutoStop,
  performSessionHealthCheck,
  sendDurationWarnings,
  SESSION_STATES,
  SESSION_CONFIG
};