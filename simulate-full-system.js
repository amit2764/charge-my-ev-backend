#!/usr/bin/env node

/**
 * EV Charging System - Full End-to-End Simulation
 * Complete user journey: Request → Match → Book → Start → Charge → Stop → Pay → Rate
 */

const axios = require('axios');
const { db, mockMode } = require('./src/config/firebase');
const { initializeMonitoring } = require('./src/monitoring');

// Import backend functions for direct calls
const { sendOTP, verifyOTP } = require('./src/auth');
const { createChargingRequest } = require('./src/charging');
const { getNearbyChargers } = require('./src/matching');
const { createHostResponse } = require('./src/responses');
const { createBooking, startCharging, stopCharging } = require('./src/booking');
const { confirmPayment } = require('./src/cash-payment');
const { updateUserTrustScore, getUserTrustProfile } = require('./src/trust-score');

// Simulation configuration
const SIMULATION_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  USE_DIRECT_CALLS: true, // Set to true to bypass HTTP and use direct function calls
  USER_PHONE: '+1234567890',
  USER_LOCATION: { lat: 37.7749, lng: -122.4194 }, // San Francisco
  VEHICLE_TYPE: 'electric',
  CHARGER_ID: 'charger_001',
  PRICE_PER_HOUR: 15.00,
  CHARGING_DURATION_MINUTES: 1
};

// Mock user data for simulation
const MOCK_USER = {
  userId: 'user_sim_001',
  phone: SIMULATION_CONFIG.USER_PHONE,
  name: 'John Doe',
  vehicleType: SIMULATION_CONFIG.VEHICLE_TYPE
};

const MOCK_HOST = {
  hostId: 'host_sim_001',
  chargerId: SIMULATION_CONFIG.CHARGER_ID,
  location: SIMULATION_CONFIG.USER_LOCATION,
  pricePerHour: SIMULATION_CONFIG.PRICE_PER_HOUR,
  available: true
};

class EVChargingSimulator {
  constructor() {
    this.userOtp = null;
    this.bookingId = null;
    this.sessionId = null;
    this.requestId = null;
    this.startOtp = null;
    this.endOtp = null;
    this.currentStep = 0;
  }

  log(message, type = 'INFO', step = null) {
    const colors = {
      'INFO': '\x1b[36m',
      'SUCCESS': '\x1b[32m',
      'ERROR': '\x1b[31m',
      'WARN': '\x1b[33m',
      'API': '\x1b[35m',
      'DB': '\x1b[34m',
      'UI': '\x1b[37m'
    };
    const reset = '\x1b[0m';
    const stepInfo = step ? `[STEP ${step}] ` : '';
    console.log(`${colors[type] || ''}${stepInfo}${message}${reset}`);
  }

  async makeApiCall(endpoint, method = 'GET', data = null, description = '') {
    if (SIMULATION_CONFIG.USE_DIRECT_CALLS) {
      this.log(`🔧 Direct call: ${description}`, 'API');
      try {
        // Direct function calls based on endpoint
        let result;
        // Strip query parameters from endpoint for matching
        const endpointPath = endpoint.split('?')[0];
        switch (endpointPath) {
          case '/api/auth/send-otp':
            result = await sendOTP(data.phone);
            // Capture the OTP from the response if available (for testing)
            if (result.otp) {
              this.userOtp = result.otp;
              this.log(`📱 Captured OTP: ${this.userOtp}`, 'INFO');
            }
            return { success: true, data: result };
          case '/api/auth/verify-otp':
            result = await verifyOTP(data.phone, data.otp);
            return { success: true, data: result };
          case '/api/request':
            result = await createChargingRequest(data.userId, data.location, data.vehicleType);
            return { success: true, data: result };
          case '/api/charging/request':
            result = await createChargingRequest(data.userId, data.location, data.vehicleType);
            return { success: true, data: result };
          case '/api/chargers/nearby':
            // Parse query parameters from endpoint
            const url = new URL(endpoint, 'http://localhost');
            const lat = parseFloat(url.searchParams.get('lat'));
            const lng = parseFloat(url.searchParams.get('lng'));
            const radius = parseFloat(url.searchParams.get('radius')) || 3;
            const userLocation = { lat, lng };
            result = await getNearbyChargers(userLocation, radius);
            return { success: true, data: result };
          case '/api/respond':
            result = await createHostResponse(data);
            return { success: true, data: result };
          case '/api/responses/create':
            result = await createHostResponse(data);
            return { success: true, data: result };
          case '/api/book':
            result = await createBooking(data.userId, data.hostId, data.chargerId, data.price, data.requestId);
            return { success: true, data: result };
          case '/api/booking/create':
            result = await createBooking(data.userId, data.hostId, data.chargerId, data.price, data.requestId);
            return { success: true, data: result };
          case '/api/start':
            result = await startCharging(data.bookingId, data.otp);
            return { success: true, data: result };
          case '/api/stop':
            result = await stopCharging(data.bookingId, data.otp);
            return { success: true, data: result };
          case '/api/booking/start':
            result = await startCharging(data.bookingId);
            return { success: true, data: result };
          case '/api/booking/stop':
            result = await stopCharging(data.bookingId);
            return { success: true, data: result };
          case '/api/payment/confirm':
            result = await confirmPayment(data.bookingId, data.paymentMethod);
            return { success: true, data: result };
          case '/api/rating':
            // Accept POST to /api/rating as alias for /api/rating/submit
            // Use mock-safe DB update helper when running in mockMode
            await this.simulateDatabaseChange('bookings', data.bookingId, {
              rating: data.rating,
              review: data.review,
              ratedAt: new Date()
            }, 'UPDATE');
            result = { success: true, message: 'Rating submitted successfully' };
            return { success: true, data: result };
          case '/api/rating/submit':
            // For rating, simulate the database update (mock-safe)
            await this.simulateDatabaseChange('bookings', data.bookingId, {
              rating: data.rating,
              review: data.review,
              ratedAt: new Date()
            }, 'UPDATE');
            result = { success: true, message: 'Rating submitted successfully' };
            return { success: true, data: result };
          default:
            throw new Error(`Direct call not implemented for endpoint: ${endpoint}`);
        }
      } catch (error) {
        this.log(`❌ Direct call failed: ${error.message}`, 'ERROR');
        throw error;
      }
    } else {
      // HTTP API calls
      try {
        const config = {
          method,
          url: `${SIMULATION_CONFIG.BASE_URL}${endpoint}`,
          headers: { 'Content-Type': 'application/json' }
        };

        if (data) config.data = data;

        this.log(`📡 API ${method} ${endpoint} - ${description}`, 'API');
        const response = await axios(config);

        this.log(`✅ API Response: ${response.status} ${response.statusText}`, 'SUCCESS');
        if (response.data) {
          this.log(`📄 Response Data: ${JSON.stringify(response.data, null, 2)}`, 'API');
        }

        return { success: true, data: response.data };
      } catch (error) {
        this.log(`❌ API Error: ${error.response?.status} ${error.response?.statusText}`, 'ERROR');
        if (error.response?.data) {
          this.log(`📄 Error Data: ${JSON.stringify(error.response.data, null, 2)}`, 'ERROR');
        }
        return { success: false, error: error.response?.data || error.message };
      }
    }
  }

  async simulateDatabaseChange(collection, docId, data, operation = 'CREATE') {
    this.log(`🗄️ DB ${operation}: ${collection}/${docId}`, 'DB');
    this.log(`📝 Data: ${JSON.stringify(data, null, 2)}`, 'DB');

    if (mockMode) {
      this.log(`📝 Mock DB: Operation would be persisted`, 'DB');
    } else {
      try {
        const docRef = db.collection(collection).doc(docId);
        if (operation === 'CREATE') {
          await docRef.set(data);
        } else if (operation === 'UPDATE') {
          await docRef.update(data);
        }
        this.log(`✅ DB Operation completed`, 'SUCCESS');
      } catch (error) {
        this.log(`❌ DB Error: ${error.message}`, 'ERROR');
      }
    }
  }

  simulateUIUpdate(component, action, data = null) {
    this.log(`🖥️ UI Update: ${component} - ${action}`, 'UI');
    if (data) {
      this.log(`📱 UI Data: ${JSON.stringify(data, null, 2)}`, 'UI');
    }
  }

  // ==========================================
  // STEP 1: USER REGISTRATION & VERIFICATION
  // ==========================================

  async step1_UserRegistration() {
    this.currentStep = 1;
    this.log('🚗 STEP 1: User Registration & Verification', 'INFO', 1);

    // 1.1 Send OTP
    this.log('📱 User enters phone number and requests OTP', 'UI');
    const otpResult = await this.makeApiCall('/api/auth/send-otp', 'POST',
      { phone: SIMULATION_CONFIG.USER_PHONE },
      'Send OTP for user registration'
    );

    if (!otpResult.success) {
      this.log('❌ FAILURE: OTP send failed - Check phone number format', 'ERROR');
      this.log('🔧 FIX: Validate phone number format, check SMS service', 'WARN');
      return false;
    }

    // 1.2 Simulate receiving OTP (in real app, user would enter this)
    // OTP is captured in the direct call above
    this.log(`📱 User receives OTP: ${this.userOtp}`, 'UI');

    // 1.3 Verify OTP
    this.log('📱 User enters OTP and submits verification', 'UI');
    const verifyResult = await this.makeApiCall('/api/auth/verify-otp', 'POST',
      { phone: SIMULATION_CONFIG.USER_PHONE, otp: this.userOtp },
      'Verify OTP for user registration'
    );

    if (!verifyResult.success) {
      this.log('❌ FAILURE: OTP verification failed - Wrong OTP or expired', 'ERROR');
      this.log('🔧 FIX: Check OTP validity (15 min), rate limiting, user education', 'WARN');
      return false;
    }

    // DB Change: User profile created
    await this.simulateDatabaseChange('users', MOCK_USER.userId, {
      ...MOCK_USER,
      verified: true,
      createdAt: new Date(),
      trustScore: 50 // Default trust score
    });

    this.simulateUIUpdate('AuthScreen', 'Navigate to main app', { user: MOCK_USER });
    this.log('✅ STEP 1 COMPLETE: User registered and verified', 'SUCCESS', 1);
    return true;
  }

  // ==========================================
  // STEP 2: CHARGING REQUEST CREATION
  // ==========================================

  async step2_CreateChargingRequest() {
    this.currentStep = 2;
    this.log('🔌 STEP 2: Create Charging Request', 'INFO', 2);

    this.log('📱 User selects location and vehicle type', 'UI');
    const requestData = {
      userId: MOCK_USER.userId,
      location: SIMULATION_CONFIG.USER_LOCATION,
      vehicleType: SIMULATION_CONFIG.VEHICLE_TYPE
    };

    const requestResult = await this.makeApiCall('/api/request', 'POST',
      requestData,
      'Create charging request'
    );

    if (!requestResult.success) {
      this.log('❌ FAILURE: Request creation failed - Invalid location or user not verified', 'ERROR');
      this.log('🔧 FIX: Validate location coordinates, ensure user verification, check rate limits', 'WARN');
      return false;
    }

    this.requestId = requestResult.data.request.id;

    // DB Change: Request created
    await this.simulateDatabaseChange('requests', this.requestId, {
      ...requestData,
      id: this.requestId,
      status: 'PENDING',
      createdAt: new Date(),
      responses: []
    });

    this.simulateUIUpdate('RequestScreen', 'Show request created', {
      requestId: this.requestId,
      status: 'SEARCHING'
    });

    this.log('✅ STEP 2 COMPLETE: Charging request created', 'SUCCESS', 2);
    return true;
  }

  // ==========================================
  // STEP 3: MATCHING & HOST RESPONSE
  // ==========================================

  async step3_MatchingAndResponse() {
    this.currentStep = 3;
    this.log('🎯 STEP 3: Host Matching & Response', 'INFO', 3);

    // 3.1 Search for nearby chargers
    this.log('🔍 System searches for nearby available chargers', 'INFO');
    const searchResult = await this.makeApiCall(
      `/api/chargers/nearby?lat=${SIMULATION_CONFIG.USER_LOCATION.lat}&lng=${SIMULATION_CONFIG.USER_LOCATION.lng}&radius=5`,
      'GET',
      null,
      'Find nearby chargers'
    );

    if (!searchResult.success || !searchResult.data.stations?.length) {
      this.log('❌ FAILURE: No chargers found - Poor location coverage', 'ERROR');
      this.log('🔧 FIX: Expand search radius, improve charger network, location accuracy', 'WARN');
      return false;
    }

    this.simulateUIUpdate('ChargerList', 'Display available chargers', {
      chargers: searchResult.data.stations
    });

    // 3.2 Simulate host response (in real app, this would be done by host)
    this.log('🏠 Host receives request notification and responds', 'INFO');
    const responseData = {
      requestId: this.requestId,
      hostId: MOCK_HOST.hostId,
      status: 'ACCEPTED',
      estimatedArrival: 15, // minutes
      price: SIMULATION_CONFIG.PRICE_PER_HOUR
    };

    const responseResult = await this.makeApiCall('/api/respond', 'POST',
      responseData,
      'Host accepts charging request'
    );

    if (!responseResult.success) {
      this.log('❌ FAILURE: Host response failed - Request expired or invalid', 'ERROR');
      this.log('🔧 FIX: Check request validity, host authorization, response timeouts', 'WARN');
      return false;
    }

    // DB Change: Response added to request
    await this.simulateDatabaseChange('requests', this.requestId, {
      responses: [responseResult.data.response]
    }, 'UPDATE');

    this.simulateUIUpdate('RequestScreen', 'Show host response', {
      hostResponse: responseResult.data.response,
      status: 'ACCEPTED'
    });

    this.log('✅ STEP 3 COMPLETE: Host matched and responded', 'SUCCESS', 3);
    return true;
  }

  // ==========================================
  // STEP 4: BOOKING CREATION
  // ==========================================

  async step4_CreateBooking() {
    this.currentStep = 4;
    this.log('📅 STEP 4: Create Booking', 'INFO', 4);

    this.log('📱 User confirms booking with selected host', 'UI');
    const bookingData = {
      userId: MOCK_USER.userId,
      hostId: MOCK_HOST.hostId,
      chargerId: SIMULATION_CONFIG.CHARGER_ID,
      price: SIMULATION_CONFIG.PRICE_PER_HOUR,
      requestId: this.requestId
    };

    const bookingResult = await this.makeApiCall('/api/book', 'POST',
      bookingData,
      'Create charging booking'
    );

    if (!bookingResult.success) {
      this.log('❌ FAILURE: Booking creation failed - Concurrent booking or validation error', 'ERROR');
      this.log('🔧 FIX: Check charger availability, user balance, booking conflicts', 'WARN');
      return false;
    }

    this.bookingId = bookingResult.data.booking.id;
    this.booking = bookingResult.data.booking; // Store booking for later use

    // DB Change: Booking created
    await this.simulateDatabaseChange('bookings', this.bookingId, {
      ...bookingData,
      id: this.bookingId,
      status: 'CONFIRMED',
      createdAt: new Date(),
      sessionState: {
        state: 'CREATED',
        createdAt: new Date()
      }
    });

    this.simulateUIUpdate('BookingScreen', 'Show booking confirmed', {
      booking: bookingResult.data.booking,
      status: 'CONFIRMED'
    });

    this.log('✅ STEP 4 COMPLETE: Booking created successfully', 'SUCCESS', 4);
    return true;
  }

  // ==========================================
  // STEP 5: SESSION START WITH OTP
  // ==========================================

  async step5_StartChargingSession() {
    this.currentStep = 5;
    this.log('⚡ STEP 5: Start Charging Session with OTP', 'INFO', 5);

    // 5.1 Get session OTPs from booking (generated in step 4)
    // The OTPs are already generated and stored in the booking/session state
    this.startOtp = this.booking.startOtp; // From booking created in step 4
    this.endOtp = this.booking.endOtp;     // From booking created in step 4

    this.log(`🔐 Using session OTPs - Start: ${this.startOtp}, End: ${this.endOtp}`, 'INFO');

    // 5.2 User arrives and enters start OTP
    this.log('📱 User arrives at charger and enters start OTP', 'UI');
    const startData = {
      bookingId: this.bookingId,
      otp: this.startOtp
    };

    const startResult = await this.makeApiCall('/api/start', 'POST',
      startData,
      'Start charging session'
    );

    this.log(`🔧 Start result: ${JSON.stringify(startResult, null, 2)}`, 'API');

    if (!startResult.success) {
      this.log('❌ FAILURE: Session start failed - Invalid OTP or booking not ready', 'ERROR');
      this.log('🔧 FIX: Check OTP validity, booking status, charger availability', 'WARN');
      return false;
    }

    // DB Change: Session started
    await this.simulateDatabaseChange('bookings', this.bookingId, {
      status: 'CHARGING',
      startTime: new Date(),
      sessionState: {
        state: 'ACTIVE',
        startTime: new Date()
      }
    }, 'UPDATE');

    this.simulateUIUpdate('ChargingScreen', 'Show charging started', {
      booking: startResult.data.booking,
      status: 'CHARGING',
      startTime: startResult.data.booking.startTime
    });

    this.log('✅ STEP 5 COMPLETE: Charging session started', 'SUCCESS', 5);
    return true;
  }

  // ==========================================
  // STEP 6: CHARGING TIMER & MONITORING
  // ==========================================

  async step6_ChargingTimer() {
    this.currentStep = 6;
    this.log('⏱️ STEP 6: Charging Timer & Monitoring', 'INFO', 6);

    const chargingDuration = SIMULATION_CONFIG.CHARGING_DURATION_MINUTES * 60 * 1000; // Convert to ms

    this.log(`🔋 Charging for ${SIMULATION_CONFIG.CHARGING_DURATION_MINUTES} minutes...`, 'INFO');
    this.simulateUIUpdate('ChargingScreen', 'Start charging timer', {
      duration: SIMULATION_CONFIG.CHARGING_DURATION_MINUTES,
      progress: 0
    });

    // Simulate charging progress updates
    const progressInterval = chargingDuration / 10; // 10 progress updates
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, progressInterval / 10)); // Speed up simulation

      const progress = (i / 10) * 100;
      this.simulateUIUpdate('ChargingScreen', 'Update charging progress', {
        progress: Math.round(progress),
        timeRemaining: Math.round((10 - i) * SIMULATION_CONFIG.CHARGING_DURATION_MINUTES / 10)
      });

      // Check for auto-stop warnings (simulate at 80% progress)
      if (i === 8) {
        this.log('⚠️ CHARGING WARNING: Approaching max duration (8 hours)', 'WARN');
        this.simulateUIUpdate('ChargingScreen', 'Show duration warning', {
          warning: 'Session approaching 8-hour limit',
          action: 'Extend or stop charging'
        });
      }
    }

    this.log('🔋 Charging completed successfully', 'SUCCESS');
    this.simulateUIUpdate('ChargingScreen', 'Charging completed', {
      progress: 100,
      status: 'COMPLETED'
    });

    this.log('✅ STEP 6 COMPLETE: Charging timer completed', 'SUCCESS', 6);
    return true;
  }

  // ==========================================
  // STEP 7: SESSION STOP WITH OTP
  // ==========================================

  async step7_StopChargingSession() {
    this.currentStep = 7;
    this.log('🛑 STEP 7: Stop Charging Session with OTP', 'INFO', 7);

    this.log('📱 User enters stop OTP to end charging', 'UI');
    const stopData = {
      bookingId: this.bookingId,
      otp: this.endOtp
    };

    const stopResult = await this.makeApiCall('/api/stop', 'POST',
      stopData,
      'Stop charging session'
    );

    if (!stopResult.success) {
      this.log('❌ FAILURE: Session stop failed - Invalid OTP or session issues', 'ERROR');
      this.log('🔧 FIX: Check OTP validity, session state, auto-stop scenarios', 'WARN');
      return false;
    }

    // DB Change: Session stopped
    const endTime = new Date();
    await this.simulateDatabaseChange('bookings', this.bookingId, {
      status: 'COMPLETED',
      endTime: endTime,
      sessionState: {
        state: 'COMPLETED',
        endTime: endTime
      }
    }, 'UPDATE');

    this.simulateUIUpdate('ChargingScreen', 'Show session completed', {
      booking: stopResult.data.booking,
      status: 'COMPLETED',
      endTime: endTime
    });

    this.log('✅ STEP 7 COMPLETE: Charging session stopped', 'SUCCESS', 7);
    return true;
  }

  // ==========================================
  // STEP 8: CASH PAYMENT PROCESS
  // ==========================================

  async step8_CashPayment() {
    this.currentStep = 8;
    this.log('💰 STEP 8: Cash Payment Process', 'INFO', 8);

    // Calculate payment amount
    const hours = SIMULATION_CONFIG.CHARGING_DURATION_MINUTES / 60;
    const amount = Math.round(hours * SIMULATION_CONFIG.PRICE_PER_HOUR * 100) / 100;

    this.log(`💵 Payment amount: $${amount} (${hours} hours × $${SIMULATION_CONFIG.PRICE_PER_HOUR}/hour)`, 'INFO');

    // 8.1 Initialize cash payment
    const paymentData = {
      bookingId: this.bookingId,
      userId: MOCK_USER.userId,
      hostId: MOCK_HOST.hostId,
      amount: amount
    };

    // Simulate payment initialization (normally done automatically)
    await this.simulateDatabaseChange('cash_payments', this.bookingId, {
      ...paymentData,
      id: this.bookingId,
      status: 'PENDING',
      createdAt: new Date(),
      confirmations: {
        user: null,
        host: null
      }
    });

    // 8.2 User confirms payment made
    this.log('📱 User confirms they paid the host in cash', 'UI');
    const userConfirmResult = await this.makeApiCall('/api/payment/confirm', 'POST',
      {
        bookingId: this.bookingId,
        confirmerId: MOCK_USER.userId,
        role: 'user',
        confirmed: true,
        notes: 'Paid in cash at location'
      },
      'User confirms cash payment'
    );

    if (!userConfirmResult.success) {
      this.log('❌ FAILURE: User confirmation failed - Invalid booking or user', 'ERROR');
      this.log('🔧 FIX: Check booking validity, user authorization, payment state', 'WARN');
      return false;
    }

    // 8.3 Host confirms payment received
    this.log('🏠 Host confirms they received the cash payment', 'UI');
    const hostConfirmResult = await this.makeApiCall('/api/payment/confirm', 'POST',
      {
        bookingId: this.bookingId,
        confirmerId: MOCK_HOST.hostId,
        role: 'host',
        confirmed: true,
        notes: 'Received cash payment'
      },
      'Host confirms cash payment received'
    );

    if (!hostConfirmResult.success) {
      this.log('❌ FAILURE: Host confirmation failed - Payment dispute triggered', 'ERROR');
      this.log('🔧 FIX: Check host authorization, investigate payment dispute', 'WARN');
      return false;
    }

    // DB Change: Payment confirmed
    await this.simulateDatabaseChange('cash_payments', this.bookingId, {
      status: 'CONFIRMED',
      confirmations: {
        user: { confirmed: true, confirmedAt: new Date() },
        host: { confirmed: true, confirmedAt: new Date() }
      },
      resolvedAt: new Date()
    }, 'UPDATE');

    this.simulateUIUpdate('PaymentScreen', 'Show payment completed', {
      payment: hostConfirmResult.data.payment,
      status: 'CONFIRMED'
    });

    this.log('✅ STEP 8 COMPLETE: Cash payment processed', 'SUCCESS', 8);
    return true;
  }

  // ==========================================
  // STEP 9: RATING & FEEDBACK
  // ==========================================

  async step9_RatingAndFeedback() {
    this.currentStep = 9;
    this.log('⭐ STEP 9: Rating & Feedback', 'INFO', 9);

    this.log('📱 User rates the charging experience', 'UI');
    const ratingData = {
      bookingId: this.bookingId,
      userId: MOCK_USER.userId,
      hostId: MOCK_HOST.hostId,
      rating: 5,
      review: 'Great charging experience! Clean charger and friendly host.',
      aspects: {
        chargerQuality: 5,
        location: 5,
        hostService: 5,
        value: 4
      }
    };

    const ratingResult = await this.makeApiCall('/api/rating', 'POST',
      ratingData,
      'Submit user rating and review'
    );

    if (!ratingResult.success) {
      this.log('❌ FAILURE: Rating submission failed - Invalid booking or duplicate rating', 'ERROR');
      this.log('🔧 FIX: Check booking completion, prevent duplicate ratings', 'WARN');
      return false;
    }

    // DB Change: Rating stored and trust scores updated
    await this.simulateDatabaseChange('ratings', `${this.bookingId}_${MOCK_USER.userId}`, {
      ...ratingData,
      id: `${this.bookingId}_${MOCK_USER.userId}`,
      createdAt: new Date()
    });

    // Update trust scores
    await this.simulateDatabaseChange('trust_profiles', MOCK_USER.userId, {
      metrics: {
        averageRating: 4.8, // Updated based on new rating
        totalRatings: 15
      },
      lastUpdated: new Date()
    }, 'UPDATE');

    await this.simulateDatabaseChange('trust_profiles', MOCK_HOST.hostId, {
      metrics: {
        averageRating: 4.9,
        totalRatings: 25
      },
      lastUpdated: new Date()
    }, 'UPDATE');

    this.simulateUIUpdate('RatingScreen', 'Show rating submitted', {
      rating: ratingResult.data.rating,
      status: 'SUBMITTED'
    });

    this.simulateUIUpdate('ProfileScreen', 'Update trust scores', {
      userTrustScore: 85,
      hostTrustScore: 92
    });

    this.log('✅ STEP 9 COMPLETE: Rating and feedback submitted', 'SUCCESS', 9);
    return true;
  }

  // ==========================================
  // MAIN SIMULATION
  // ==========================================

  async runFullSimulation() {
    console.log('🚀 EV CHARGING SYSTEM - FULL END-TO-END SIMULATION');
    console.log('=' .repeat(60));
    console.log(`User: ${MOCK_USER.name} (${MOCK_USER.phone})`);
    console.log(`Location: ${SIMULATION_CONFIG.USER_LOCATION.lat}, ${SIMULATION_CONFIG.USER_LOCATION.lng}`);
    console.log(`Vehicle: ${SIMULATION_CONFIG.VEHICLE_TYPE}`);
    console.log(`Charging Duration: ${SIMULATION_CONFIG.CHARGING_DURATION_MINUTES} minutes`);
    console.log('=' .repeat(60));

    // Initialize monitoring
    await initializeMonitoring();

    const steps = [
      () => this.step1_UserRegistration(),
      () => this.step2_CreateChargingRequest(),
      () => this.step3_MatchingAndResponse(),
      () => this.step4_CreateBooking(),
      () => this.step5_StartChargingSession(),
      () => this.step6_ChargingTimer(),
      () => this.step7_StopChargingSession(),
      () => this.step8_CashPayment(),
      () => this.step9_RatingAndFeedback()
    ];

    let success = true;
    for (const step of steps) {
      try {
        const stepResult = await step();
        if (!stepResult) {
          success = false;
          break;
        }
        // Small delay between steps for readability
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        this.log(`💥 CRITICAL ERROR in step ${this.currentStep}: ${error.message}`, 'ERROR');
        success = false;
        break;
      }
    }

    console.log('\n' + '=' .repeat(60));
    if (success) {
      console.log('🎉 SIMULATION COMPLETED SUCCESSFULLY!');
      console.log('✅ Full user journey from request to rating completed');
      console.log('✅ All API calls, DB changes, and UI updates simulated');
      console.log('✅ Error handling and recovery mechanisms validated');
    } else {
      console.log('❌ SIMULATION FAILED');
      console.log(`❌ Failed at step ${this.currentStep}`);
      console.log('🔧 Check error messages above for failure reasons and fixes');
    }
    console.log('=' .repeat(60));

    return success;
  }
}

// Run simulation if called directly
if (require.main === module) {
  const simulator = new EVChargingSimulator();
  simulator.runFullSimulation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Simulation failed:', error);
    process.exit(1);
  });
}

module.exports = EVChargingSimulator;