const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Sentry = require('@sentry/node');

let ProfilingIntegration = null;
try {
  ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
} catch (e) {
  console.warn('⚠️ Sentry profiling disabled locally (Windows binary missing)');
}

const { initializeWebSocketServer, emitToRequest, emitToUser } = require('./realtime');
// NOTE: OTP handling moved to Firebase Phone Auth on frontend
// Backend only handles user session/profile after Firebase auth succeeds
const { isUserVerified, validatePhone, ensureVerifiedUser } = require('./auth');
const { createChargingRequest, getChargingRequest } = require('./charging');
const { uploadImage } = require('./storage');
const { getNearbyChargers } = require('./matching');
const { createHostResponse, getResponsesForRequest } = require('./responses');
const { createBooking, startCharging, stopCharging } = require('./booking');
const { startAutoStopJob, stopAutoStopJob, getAutoStopStatus, runAutoStopCheck } = require('./auto-stop');
const { startAutoCloseJob, stopAutoCloseJob, getAutoCloseStatus, runAutoCloseCheck } = require('./auto-close');
const { calculateTrustScore, updateUserTrustScore, getUserTrustProfile, getUsersTrustProfiles, getAllTrustProfiles, getTrustScoreGuidance, getUserRanking, getTopRankedUsers } = require('./trust-score');
const { initializeMonitoring, trackApiFailure, trackOtpError, trackBookingFailure, trackSessionIssue, getMetrics, getRecentLogs, getRecentAlerts } = require('./monitoring');
const { 
  notifyNewRequest, 
  notifyRequestAccepted, 
  notifyOTPRequired, 
  notifySessionStarted, 
  notifySessionStopped,
  storeDeviceToken 
} = require('./notifications');
const { performSessionHealthCheck, getSessionState } = require('./session-manager');
const { initializeCashPayment, confirmPayment, getPaymentStatus } = require('./cash-payment');
const { createPaymentOrder, verifyPaymentSignature, processWebhook } = require('./online-payment');
const { emailQueue, initializeWorkers } = require('./jobs');
const { sendReceiptEmail } = require('./email');
const multer = require('multer');
const { requireAdmin, validateUserId } = require('./security');

dotenv.config();

const app = express();

const sentryIntegrations = [
  new Sentry.Integrations.Http({ tracing: true }),
  new Sentry.Integrations.Express({ app })
];

if (ProfilingIntegration) {
  sentryIntegrations.push(new ProfilingIntegration());
}

// Initialize Sentry as early as possible
Sentry.init({
  dsn: process.env.SENTRY_DSN, // Add this to your .env file
  integrations: sentryIntegrations,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(helmet());
app.use(cors({ origin: allowedOrigin, optionsSuccessStatus: 200 }));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString(); // Save raw body for webhook verification
  }
}));
app.use(express.urlencoded({ extended: true }));

// Multer configuration for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image file.'), false);
    }
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

// OTP limiter removed: OTP handling moved to Firebase client-side auth
// Firebase provides its own rate limiting for phone auth

app.use(generalLimiter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running normally'
  });
});

// ========== AUTHENTICATION ARCHITECTURE ==========
// OTP/Phone Auth Flow:
// 1. Frontend: User enters phone number
// 2. Frontend: Firebase sends OTP via SMS directly
// 3. Frontend: User enters OTP
// 4. Frontend: Firebase Phone Auth verifies OTP → Firebase Auth session created
// 5. Backend: Receives Firebase ID token from frontend for subsequent requests
// 6. Backend: User profile/session management only (NOT OTP handling)
//
// Backend OTP endpoints (DEPRECATED & DISABLED):
// These endpoints are NO LONGER USED. Phone authentication is now
// handled entirely by Firebase on the frontend using RecaptchaVerifier.
// This eliminates the need for:
// - SMS provider subscriptions (Fast2SMS, Twilio, etc.)
// - Backend OTP generation/validation logic
// - OTP database/cache management
// ================================================

// API endpoint for user registration/profile after Firebase auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firebaseUid, phone, name } = req.body;
    
    if (!firebaseUid || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID and phone number are required'
      });
    }

    // TODO: Create/update user profile in Firestore
    // This is optional - can be called after successful Firebase Phone Auth

    res.status(200).json({
      success: true,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
});

// OLD DEPRECATED ENDPOINTS (kept for reference, commented out):
// app.post('/api/auth/send-otp', ...) 
// app.post('/api/auth/verify-otp', ...)
// These are NO LONGER USED - Firebase handles OTP on the frontend

// API endpoint to create charging request
app.post('/api/request', async (req, res) => {
  try {
    const { userId, location, vehicleType } = req.body;

    // Validate request body
    if (!userId || !location || !vehicleType) {
      return res.status(400).json({
        success: false,
        error: 'userId, location, and vehicleType are required'
      });
    }

    // Call createChargingRequest function
      const verification = await ensureVerifiedUser(userId);
    if (!verification.success) {
      return res.status(403).json(verification);
    }

    const result = await createChargingRequest(userId, location, vehicleType);

    if (result.success) {
      // Send push notifications to nearby hosts (async, don't wait)
      if (typeof notifyNewRequest === 'function') {
        notifyNewRequest(result.request.id, {
          userId,
          location,
          vehicleType
        }).catch(error => {
          console.error('Failed to send new request notifications:', error);
        });
      }

      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create charging request endpoint error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

// API endpoint to get charging request by ID
app.get('/api/request/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Call getChargingRequest function
    const result = await getChargingRequest(id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    console.error('Get charging request endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to get pending requests for hosts
app.get('/api/requests/pending', async (req, res) => {
  try {
    const { db, mockMode } = require('./config/firebase');
    if (mockMode) return res.status(200).json({ success: true, requests: [] });

    const snapshot = await db.collection('requests')
      .where('status', '==', 'OPEN')
      .limit(10)
      .get();

    const requests = [];
    snapshot.forEach(doc => {
      requests.push({ id: doc.id, distance: 'Nearby', rating: '5.0', ...doc.data() });
    });

    res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error('Pending requests endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
});

// API endpoint to get nearby charging stations
app.get('/api/chargers/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    // Parse and validate query parameters
    const userLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };

    const searchRadius = radius ? parseFloat(radius) : 3; // Default 3km

    // Call getNearbyChargers function
    const result = await getNearbyChargers(userLocation, searchRadius);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Get nearby chargers endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to create host response
app.post('/api/respond', async (req, res) => {
  try {
    const { requestId, hostId, status, message, estimatedArrival, price } = req.body;

    // Validate request body
    if (!requestId || !hostId) {
      return res.status(400).json({
        success: false,
        error: 'requestId and hostId are required'
      });
    }

    // Prepare response data
    const responseData = {};
    if (status) responseData.status = status;
    if (message) responseData.message = message;
    if (estimatedArrival !== undefined) responseData.estimatedArrival = estimatedArrival;
    if (price !== undefined) responseData.price = price;

    // Call createHostResponse function
    const result = await createHostResponse(requestId, hostId, responseData);

    if (result.success) {
      // Emit real-time update to the frontend via WebSockets
      emitToRequest(requestId, 'response_update', { action: 'added', response: result.response });

      // If response is accepted, notify the user who made the request
      if (responseData.status && responseData.status.toUpperCase() === 'ACCEPTED') {
        // Get request details to find userId
        const requestResult = await getChargingRequest(requestId);
        if (requestResult.success && typeof notifyRequestAccepted === 'function') {
          notifyRequestAccepted(requestId, requestResult.request.userId, result.response)
            .catch(error => {
              console.error('Failed to send request accepted notification:', error);
            });
        }
      }

      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create host response endpoint error:', error);
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
});

// API endpoint to get responses for a request
app.get('/api/responses/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    // Call getResponsesForRequest function
    const result = await getResponsesForRequest(requestId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    console.error('Get responses endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to create booking
app.post('/api/book', async (req, res) => {
  try {
    const { userId, hostId, chargerId, price, requestId } = req.body;

    if (!userId || !hostId || !chargerId || price === undefined || !requestId) {
      return res.status(400).json({
        success: false,
        error: 'userId, hostId, chargerId, price, and requestId are required'
      });
    }

    if (!validateUserId(requestId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid requestId is required'
      });
    }

    const verification = await ensureVerifiedUser(userId);
    if (!verification.success) {
      return res.status(403).json(verification);
    }

    const result = await createBooking(userId, hostId, chargerId, price, requestId);

    if (result.success) {
      // Notify clients watching this request that it has been booked
      emitToRequest(requestId, 'booking_update', { status: 'CONFIRMED', booking: result.booking });
      emitToUser(hostId, 'new_booking', result.booking);

      res.status(201).json(result);
    } else {
      // Track booking failure
      await trackBookingFailure(userId, hostId, 'CREATION_FAILED', result.error, { chargerId, price, requestId });
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Create booking endpoint error:', error);
    // Track booking system error
    await trackBookingFailure(userId || 'unknown', hostId || 'unknown', 'SYSTEM_ERROR', error.message, { chargerId, price, requestId });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to start charging
app.post('/api/start', async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    // Validate request body
    if (!bookingId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'bookingId and otp are required'
      });
    }

    // Call startCharging function
    const result = await startCharging(bookingId, otp);

    if (result.success) {
      // Push real-time status update to both host and user
      emitToUser(result.booking.userId, 'session_update', { status: 'CHARGING', booking: result.booking });
      
      // Notify user that session has started
      notifySessionStarted(bookingId, result.booking.userId, result.booking.startTime)
        .catch(error => {
          console.error('Failed to send session started notification:', error);
        });

      res.status(200).json(result);
    } else {
      // Track session start failure
      await trackSessionIssue(bookingId, result.userId || 'unknown', 'START_FAILED', result.error, { otpProvided: !!otp });
      
      // If OTP is invalid, notify user that OTP is required
      if (result.error === 'Invalid OTP' && result.userId) {
        notifyOTPRequired(bookingId, result.userId, 'start')
          .catch(error => {
            console.error('Failed to send OTP required notification:', error);
          });
      }

      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Start charging endpoint error:', error);
    // Track session system error
    await trackSessionIssue(bookingId || 'unknown', 'unknown', 'SYSTEM_ERROR', error.message, { otpProvided: !!otp });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to stop charging
app.post('/api/stop', async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    // Validate request body
    if (!bookingId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'bookingId and otp are required'
      });
    }

    // Call stopCharging function
    const result = await stopCharging(bookingId, otp);

    if (result.success) {
      // Push real-time status update
      emitToUser(result.booking.userId, 'session_update', { status: 'COMPLETED', booking: result.booking });

      // Queue a background job to send the email receipt
      const targetEmail = req.body.email || result.booking.userEmail;
      if (targetEmail && emailQueue) {
        emailQueue.add({ toEmail: targetEmail, bookingDetails: result.booking });
      } else if (targetEmail) {
        // Fallback for when Redis isn't configured
        sendReceiptEmail(targetEmail, result.booking).catch(err => console.error('Fallback email receipt error:', err));
      }

      // Notify user that session has stopped
      notifySessionStopped(bookingId, result.booking.userId, {
        finalAmount: result.finalAmount,
        duration: result.durationMinutes,
        endTime: result.booking.endTime
      }).catch(error => {
        console.error('Failed to send session stopped notification:', error);
      });

      res.status(200).json(result);
    } else {
      // If OTP is invalid, notify user that OTP is required
      if (result.error === 'Invalid OTP' && result.userId) {
        notifyOTPRequired(bookingId, result.userId, 'stop')
          .catch(error => {
            console.error('Failed to send OTP required notification:', error);
          });
      }

      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Stop charging endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to get user booking history
app.get('/api/bookings/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { db, mockMode } = require('./config/firebase');
    if (mockMode) return res.status(200).json({ success: true, bookings: [] });

    const snapshot = await db.collection('bookings')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const bookings = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      bookings.push({ id: doc.id, date: data.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent', host: `Host ${data.hostId.slice(-4)}`, duration: `${data.durationMinutes || 0} mins`, amount: data.finalAmount || 0, status: data.status, ...data });
    });

    res.status(200).json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// API endpoint to get host earnings
app.get('/api/hosts/:hostId/earnings', async (req, res) => {
  try {
    const { hostId } = req.params;
    const { db, mockMode } = require('./config/firebase');
    if (mockMode) return res.status(200).json({ success: true, sessions: [] });

    const snapshot = await db.collection('bookings')
      .where('hostId', '==', hostId)
      .where('status', '==', 'COMPLETED')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const sessions = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      sessions.push({ id: doc.id, date: data.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent', user: `User ${data.userId.slice(-4)}`, duration: `${data.durationMinutes || 0} mins`, amount: data.finalAmount || 0, ...data });
    });

    res.status(200).json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch earnings' });
  }
});

// API endpoint to check auto-stop job status
app.get('/api/auto-stop/status', (req, res) => {
  try {
    const status = getAutoStopStatus();
    res.status(200).json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Auto-stop status endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-stop status'
    });
  }
});

// API endpoint to start auto-stop job
app.post('/api/auto-stop/start', requireAdmin, (req, res) => {
  try {
    const result = startAutoStopJob();
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Start auto-stop endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start auto-stop job'
    });
  }
});

// API endpoint to stop auto-stop job
app.post('/api/auto-stop/stop', requireAdmin, (req, res) => {
  try {
    const result = stopAutoStopJob();
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Stop auto-stop endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop auto-stop job'
    });
  }
});

// API endpoint to manually trigger auto-stop check
app.post('/api/auto-stop/check', requireAdmin, async (req, res) => {
  try {
    const result = await runAutoStopCheck();
    res.status(200).json(result);
  } catch (error) {
    console.error('Auto-stop check endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run auto-stop check'
    });
  }
});

// API endpoint to get session health status
app.get('/api/sessions/health', requireAdmin, async (req, res) => {
  try {
    const healthReport = await performSessionHealthCheck();
    res.status(200).json({
      success: true,
      health: healthReport
    });
  } catch (error) {
    console.error('Session health endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session health status'
    });
  }
});

// API endpoint to get session state
app.get('/api/sessions/:bookingId/state', async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'bookingId parameter is required'
      });
    }

    const sessionState = await getSessionState(bookingId);

    if (sessionState.error) {
      return res.status(404).json({
        success: false,
        error: 'Session state not found'
      });
    }

    res.status(200).json({
      success: true,
      sessionState
    });
  } catch (error) {
    console.error('Session state endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session state'
    });
  }
});

// =============== AUTO-CLOSE ENDPOINTS ===============

// API endpoint to get auto-close job status
app.get('/api/auto-close/status', (req, res) => {
  try {
    const status = getAutoCloseStatus();
    res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Auto-close status endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-close status'
    });
  }
});

// API endpoint to start auto-close job
app.post('/api/auto-close/start', requireAdmin, (req, res) => {
  try {
    const result = startAutoCloseJob();
    res.status(200).json(result);
  } catch (error) {
    console.error('Start auto-close endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start auto-close job'
    });
  }
});

// API endpoint to stop auto-close job
app.post('/api/auto-close/stop', requireAdmin, (req, res) => {
  try {
    const result = stopAutoCloseJob();
    res.status(200).json(result);
  } catch (error) {
    console.error('Stop auto-close endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop auto-close job'
    });
  }
});

// API endpoint to manually trigger auto-close check
app.post('/api/auto-close/check', requireAdmin, async (req, res) => {
  try {
    const result = await runAutoCloseCheck();
    res.status(200).json(result);
  } catch (error) {
    console.error('Auto-close check endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run auto-close check'
    });
  }
});

// =============== TRUST SCORE ENDPOINTS ===============

// API endpoint to calculate trust score
app.post('/api/trust-score/calculate', (req, res) => {
  try {
    const {
      completionRate,
      cancellationRate,
      paymentReliability,
      averageResponseTime,
      averageRating
    } = req.body;

    if (completionRate === undefined || cancellationRate === undefined ||
        paymentReliability === undefined || averageResponseTime === undefined ||
        averageRating === undefined) {
      return res.status(400).json({
        success: false,
        error: 'completionRate, cancellationRate, paymentReliability, averageResponseTime, and averageRating are required'
      });
    }

    const result = calculateTrustScore({
      completionRate,
      cancellationRate,
      paymentReliability,
      averageResponseTime,
      averageRating
    });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Calculate trust score endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate trust score'
    });
  }
});

// API endpoint to update user trust score
app.post('/api/trust-score/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      completionRate,
      cancellationRate,
      paymentReliability,
      averageResponseTime,
      averageRating
    } = req.body;

    // Allow partial updates - if metrics not provided, they will be auto-calculated
    const metrics = {};
    if (completionRate !== undefined) metrics.completionRate = completionRate;
    if (cancellationRate !== undefined) metrics.cancellationRate = cancellationRate;
    if (paymentReliability !== undefined) metrics.paymentReliability = paymentReliability;
    if (averageResponseTime !== undefined) metrics.averageResponseTime = averageResponseTime;
    if (averageRating !== undefined) metrics.averageRating = averageRating;

    const result = await updateUserTrustScore(userId, Object.keys(metrics).length > 0 ? metrics : null);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update trust score endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trust score'
    });
  }
});

// API endpoint to recalculate trust score from user data
app.post('/api/trust-score/:userId/recalculate', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Force recalculation from current user data
    const result = await updateUserTrustScore(userId, null);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Trust score recalculated from user data',
        profile: result.profile
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Recalculate trust score endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate trust score'
    });
  }
});

// API endpoint to get user trust profile
app.get('/api/trust-score/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await getUserTrustProfile(userId);

    if (result.success) {
      res.status(200).json({
        success: true,
        profile: result.profile,
        guidance: getTrustScoreGuidance(result.profile.trustScore)
      });
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get trust profile endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trust profile'
    });
  }
});

// API endpoint to get user ranking
app.get('/api/ranking/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await getUserRanking(userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get user ranking endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user ranking'
    });
  }
});

// API endpoint to get top ranked users leaderboard
app.get('/api/ranking/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const result = await getTopRankedUsers(limit);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get leaderboard endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard'
    });
  }
});

// API endpoint to get multiple trust profiles
app.post('/api/trust-score/batch/profiles', async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds must be a non-empty array'
      });
    }

    const result = await getUsersTrustProfiles(userIds);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get trust profiles endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trust profiles'
    });
  }
});

// API endpoint to get all trust profiles (admin)
app.get('/api/trust-score/admin/all', requireAdmin, async (req, res) => {
  try {
    const result = await getAllTrustProfiles();

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get all trust profiles endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get all trust profiles'
    });
  }
});

// =============== CASH PAYMENT ENDPOINTS ===============

// API endpoint to get payment status
app.get('/api/payment/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { userId } = req; // From auth middleware

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'bookingId parameter is required'
      });
    }

    // Verify user is part of the booking
    let booking = null;
    if (mockMode) {
      booking = { userId, hostId: 'mock_host' };
    } else {
      const bookingDoc = await db.collection('bookings').doc(bookingId).get();
      if (!bookingDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      booking = bookingDoc.data();
    }

    if (booking.userId !== userId && booking.hostId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You are not part of this booking'
      });
    }

    const result = await getPaymentStatus(bookingId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    console.error('Get payment status endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
});

// API endpoint to manually resolve payment dispute (admin only)
app.post('/api/payment/:bookingId/resolve', requireAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { resolution, penalties, adminNotes } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        error: 'resolution is required'
      });
    }

    const result = await manuallyResolveDispute(bookingId, resolution, penalties || {}, adminNotes || '');

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Manual dispute resolution endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve dispute'
    });
  }
});

// API endpoint to check expired payment confirmations (admin)
app.post('/api/payment/check-expired', requireAdmin, async (req, res) => {
  try {
    const result = await checkExpiredConfirmations();
    res.status(200).json(result);
  } catch (error) {
    console.error('Check expired confirmations endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check expired confirmations'
    });
  }
});

// API endpoint to store device token for push notifications
app.post('/api/notifications/token', async (req, res) => {
  try {
    const { userId, token, deviceId } = req.body;

    if (!userId || !token || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'userId, token, and deviceId are required'
      });
    }

    const result = await storeDeviceToken(userId, token, deviceId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Store device token endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store device token'
    });
  }
});

//
// MONITORING ENDPOINTS (Admin Only)
//

// API endpoint for Admin Login
app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const adminKey = process.env.ADMIN_API_KEY;

    if (!adminKey) {
      return res.status(500).json({ success: false, error: 'Server misconfigured: ADMIN_API_KEY missing' });
    }

    if (password !== adminKey) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    let role = 'READ_ONLY';
    if (email.includes('super')) role = 'SUPER_ADMIN';
    else if (email.includes('ops')) role = 'OPS_MANAGER';
    else if (email.includes('support')) role = 'SUPPORT_AGENT';

    res.status(200).json({ success: true, token: adminKey, role, user: { email, name: 'Operator' } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get monitoring metrics
app.get('/api/admin/monitoring/metrics', requireAdmin, (req, res) => {
  try {
    const metrics = getMetrics();
    res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Get metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics'
    });
  }
});

// Get recent logs
app.get('/api/admin/monitoring/logs', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await getRecentLogs(limit);
    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Get logs endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get logs'
    });
  }
});

// Get recent alerts
app.get('/api/admin/monitoring/alerts', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await getRecentAlerts(limit);
    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Get alerts endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts'
    });
  }
});

// =============== ONLINE PAYMENT ENDPOINTS ===============

// API endpoint to create a Razorpay order
app.post('/api/payment/online/create-order', async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    
    if (!bookingId || !amount) {
      return res.status(400).json({ success: false, error: 'bookingId and amount are required' });
    }
    
    const result = await createPaymentOrder(bookingId, amount);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create order endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// API endpoint to verify Razorpay payment
app.post('/api/payment/online/verify', async (req, res) => {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, signature } = req.body;
    
    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !signature) {
      return res.status(400).json({ success: false, error: 'Missing payment verification parameters' });
    }
    
    const result = await verifyPaymentSignature(bookingId, razorpayOrderId, razorpayPaymentId, signature);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Verify payment endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// API endpoint for Razorpay webhooks
app.post('/api/payment/online/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature || !req.rawBody) {
      return res.status(400).send('Missing signature or body');
    }
    
    const result = await processWebhook(req.rawBody, signature);
    
    // Always return 200 OK to Razorpay to prevent them from retrying
    if (result.success) {
      res.status(200).send('OK');
    } else {
      res.status(400).send(result.error);
    }
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).send('Internal Error');
  }
});

// API endpoint for uploading an image
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided.' });
    }

    // The 'image' field in the form-data is the file
    // The destination path can be dynamic, e.g., based on user ID or type
    const destination = req.body.type === 'profile' ? 'profile_pictures/' : 'charger_images/';
    const publicUrl = await uploadImage(req.file, destination);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: publicUrl,
    });
  } catch (error) {
    console.error('Image upload endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload image.' });
  }
});

// API endpoint to submit rating
app.post('/api/rating', async (req, res) => {
  try {
    const { bookingId, userId, hostId, rating, review, aspects } = req.body;

    // Validate request body
    if (!bookingId || !userId || !hostId || rating === undefined) {
      return res.status(400).json({
        success: false,
        error: 'bookingId, userId, hostId, and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Verify user is verified
    const verification = await ensureVerifiedUser(userId);
    if (!verification.success) {
      return res.status(403).json(verification);
    }

    // Create rating record
    const ratingData = {
      bookingId,
      userId,
      hostId,
      rating: parseInt(rating),
      review: review || '',
      aspects: aspects || {},
      createdAt: new Date()
    };

    const ratingId = `${bookingId}_${userId}`;

    if (mockMode) {
      // Mock storage
      if (!global.mockRatings) global.mockRatings = new Map();
      global.mockRatings.set(ratingId, ratingData);
    } else {
      // Firestore
      await db.collection('ratings').doc(ratingId).set(ratingData);
    }

    // Update trust scores based on rating
    const userProfileResult = await getUserTrustProfile(userId);
    const hostProfileResult = await getUserTrustProfile(hostId);

    if (userProfileResult.success && hostProfileResult.success) {
      // Simple trust score update (in real app, this would be more sophisticated)
      const newUserScore = Math.min(100, userProfileResult.profile.trustScore + (rating - 3) * 2);
      const newHostScore = Math.min(100, hostProfileResult.profile.trustScore + (rating - 3) * 2);

      await updateUserTrustScore(userId, null); // Recalculate based on all ratings
      await updateUserTrustScore(hostId, null); // Recalculate based on all ratings
    }

    res.status(201).json({
      success: true,
      rating: {
        id: ratingId,
        ...ratingData
      }
    });

  } catch (error) {
    console.error('Submit rating endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// The Sentry error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Initialize WebSocket server
initializeWebSocketServer(server);

// Initialize background job workers
initializeWorkers();

// General error handler middleware for API failures
app.use(async (err, req, res, next) => {
  // Track API failure
  await trackApiFailure(
    req.originalUrl,
    req.method,
    err.status || 500,
    err.message || 'Internal server error',
    {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.body,
      query: req.query,
      params: req.params
    }
  );
  
  // Send explicit errors to Sentry
  Sentry.captureException(err);

  // Log the error
  console.error(`API Error [${req.method} ${req.originalUrl}]:`, err);

  // Send error response
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is actively listening on port ${PORT}`);
  
  // Initialize monitoring system
  await initializeMonitoring();
  
  // Start auto-stop background job on server startup
  setTimeout(() => {
    console.log('\n--- Initializing Auto-Stop Service ---');
    const result = startAutoStopJob();
    console.log(`Auto-Stop Service: ${result.status}`);
    console.log('--- Auto-Stop Service Ready ---\n');
  }, 1000);

  // Start auto-close background job on server startup
  setTimeout(() => {
    console.log('\n--- Initializing Auto-Close Service ---');
    const result = startAutoCloseJob();
    console.log(`Auto-Close Service: ${result.status}`);
    console.log('--- Auto-Close Service Ready ---\n');
  }, 1500);

  // Initialize session manager
  setTimeout(() => {
    console.log('\n--- Initializing Session Manager ---');
    console.log('Session Manager: Ready for hardened OTP session handling');
    console.log('--- Session Manager Ready ---\n');
  }, 2000);
});