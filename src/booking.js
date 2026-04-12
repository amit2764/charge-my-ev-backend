const { db, mockMode } = require('./config/firebase');
const { calculateBillingAmount } = require('./billing');
const {
  generateSessionOTPs,
  startChargingSession,
  stopChargingSession,
  updateSessionState,
  SESSION_STATES
} = require('./session-manager');
const { initializeCashPayment } = require('./cash-payment');

// Mock storage for bookings in development
let mockBookings = new Map();

async function createBooking(userId, hostId, chargerId, price, requestId) {
  try {
    // Validate inputs
    if (!userId || !hostId || !chargerId || price === undefined || !requestId) {
      return {
        success: false,
        error: 'userId, hostId, chargerId, price, and requestId are required'
      };
    }

    if (typeof requestId !== 'string' || requestId.trim().length === 0) {
      return {
        success: false,
        error: 'Valid requestId is required'
      };
    }

    if (typeof price !== 'number' || price < 0) {
      return {
        success: false,
        error: 'price must be a non-negative number'
      };
    }

    if (mockMode) {
      // Mock mode: simple check (not atomic)
      const existingBooking = Array.from(mockBookings.values()).find(
        b => b.requestId === requestId && b.hostId === hostId
      );
      if (existingBooking) {
        return {
          success: false,
          error: 'This host response has already been booked'
        };
      }

      // Create booking record
      const bookingData = {
        userId,
        hostId,
        requestId,
        chargerId,
        status: 'BOOKED',
        price,
        createdAt: new Date()
      };

      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      mockBookings.set(bookingId, { ...bookingData, id: bookingId });

      // Generate session OTPs using session manager
      const otpResult = await generateSessionOTPs(bookingId);
      if (!otpResult.success) {
        return { success: false, error: 'Failed to generate session OTPs' };
      }

      // Update booking with OTPs
      const updatedBooking = {
        ...bookingData,
        id: bookingId,
        startOtp: otpResult.startOtp,
        endOtp: otpResult.endOtp,
        otpExpiresAt: otpResult.expiresAt
      };
      mockBookings.set(bookingId, updatedBooking);

      return {
        success: true,
        booking: updatedBooking
      };
    } else {
      // Firestore mode: Use transaction for atomic booking
      return await db.runTransaction(async (transaction) => {
        // Step 1: Check if booking already exists for this requestId + hostId
        const existingBookingsQuery = db.collection('bookings')
          .where('requestId', '==', requestId)
          .where('hostId', '==', hostId)
          .limit(1);

        const existingBookingsSnapshot = await transaction.get(existingBookingsQuery);

        if (!existingBookingsSnapshot.empty) {
          throw new Error('DOUBLE_BOOKING: This host response has already been booked');
        }

        // Step 2: Verify the host response is still ACCEPTED
        const responseQuery = db.collection('host_responses')
          .where('requestId', '==', requestId)
          .where('hostId', '==', hostId)
          .where('status', '==', 'ACCEPTED')
          .limit(1);

        const responseSnapshot = await transaction.get(responseQuery);

        if (responseSnapshot.empty) {
          throw new Error('INVALID_RESPONSE: Host response not found or not accepted');
        }

        const responseDoc = responseSnapshot.docs[0];
        const responseData = responseDoc.data();

        // Step 3: Create booking data (OTPs will be generated separately)
        const bookingData = {
          userId,
          hostId,
          requestId,
          chargerId,
          status: 'BOOKED',
          price,
          responseId: responseDoc.id, // Link to the response
          createdAt: new Date()
        };

        // Step 4: Add booking document
        const bookingRef = db.collection('bookings').doc();
        transaction.set(bookingRef, {
          ...bookingData,
          createdAt: new Date() // Firestore timestamp
        });

        // Step 5: Update response status to BOOKED (optional, for tracking)
        transaction.update(responseDoc.ref, {
          status: 'BOOKED',
          bookedBy: userId,
          bookedAt: new Date(),
          updatedAt: new Date()
        });

        // Step 6: Generate session OTPs using session manager
        const otpResult = await generateSessionOTPs(bookingRef.id);
        if (!otpResult.success) {
          throw new Error('Failed to generate session OTPs');
        }

        // Step 7: Update booking with OTPs
        transaction.update(bookingRef, {
          startOtp: otpResult.startOtp,
          endOtp: otpResult.endOtp,
          otpExpiresAt: otpResult.expiresAt,
          updatedAt: new Date()
        });

        return {
          success: true,
          booking: {
            id: bookingRef.id,
            ...bookingData,
            startOtp: otpResult.startOtp,
            endOtp: otpResult.endOtp,
            otpExpiresAt: otpResult.expiresAt
          }
        };
      });
    }
  } catch (error) {
    console.error('Error creating booking:', error);

    if (error.message === 'DOUBLE_BOOKING: This host response has already been booked') {
      return {
        success: false,
        error: 'This host response has already been booked'
      };
    }

    if (error.message === 'INVALID_RESPONSE: Host response not found or not accepted') {
      return {
        success: false,
        error: 'Host response is no longer available'
      };
    }

    return {
      success: false,
      error: 'Failed to create booking'
    };
  }
}

async function startCharging(bookingId, otp) {
  try {
    // Validate inputs
    if (!bookingId || !otp) {
      return {
        success: false,
        error: 'bookingId and otp are required'
      };
    }

    // Retrieve booking
    let booking = null;
    if (mockMode) {
      booking = mockBookings.get(bookingId);
    } else {
      const bookingDoc = await db.collection('bookings').doc(bookingId).get();
      if (bookingDoc.exists) {
        booking = { id: bookingDoc.id, ...bookingDoc.data() };
      }
    }

    if (!booking) {
      return {
        success: false,
        error: 'Booking not found',
        userId: null // No userId available
      };
    }

    // Check if booking is in BOOKED status
    if (booking.status !== 'BOOKED') {
      return {
        success: false,
        error: `Cannot start charging: booking status is ${booking.status}`
      };
    }

    // Use session manager for hardened session start
    const sessionResult = await startChargingSession(bookingId, otp, booking);
    if (!sessionResult.success) {
      return {
        success: false,
        error: sessionResult.error,
        userId: booking.userId
      };
    }

    // Update booking with start time and status
    const updateData = {
      status: 'STARTED',
      startTime: sessionResult.startTime,
      updatedAt: new Date()
    };

    if (mockMode) {
      Object.assign(booking, updateData);
      mockBookings.set(bookingId, booking);
    } else {
      await db.collection('bookings').doc(bookingId).update(updateData);
      booking = { ...booking, ...updateData };
    }

    return {
      success: true,
      booking: booking
    };
  } catch (error) {
    console.error('Error starting charging:', error);
    return {
      success: false,
      error: 'Failed to start charging'
    };
  }
}

async function stopCharging(bookingId, otp) {
  try {
    // Validate inputs: Check that both bookingId and otp are provided
    if (!bookingId || !otp) {
      return {
        success: false,
        error: 'bookingId and otp are required'
      };
    }

    // Retrieve booking from storage (mock or Firestore)
    let booking = null;
    if (mockMode) {
      // Mock mode: get from in-memory Map
      booking = mockBookings.get(bookingId);
    } else {
      // Firestore: fetch document from database
      const bookingDoc = await db.collection('bookings').doc(bookingId).get();
      if (bookingDoc.exists) {
        booking = { id: bookingDoc.id, ...bookingDoc.data() };
      }
    }

    // Check if booking exists in storage
    if (!booking) {
      return {
        success: false,
        error: 'Booking not found',
        userId: null
      };
    }

    // Validate that booking is in STARTED status (cannot stop if not started)
    if (booking.status !== 'STARTED') {
      return {
        success: false,
        error: `Cannot stop charging: booking status is ${booking.status}`,
        userId: booking.userId
      };
    }

    // Use session manager for hardened session stop
    const sessionResult = await stopChargingSession(bookingId, otp, booking);
    if (!sessionResult.success) {
      return {
        success: false,
        error: sessionResult.error,
        userId: booking.userId
      };
    }

    // Check if startTime exists (should always exist if status is STARTED)
    if (!booking.startTime) {
      return {
        success: false,
        error: 'Booking has no start time'
      };
    }

    // Calculate billing using the billing logic module
    const endTime = sessionResult.endTime;
    const startTimeDate = booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime);

    // Calculate billing with 5-minute buffer (optional, can be configured)
    const billingResult = calculateBillingAmount(startTimeDate, endTime, booking.price, 0);

    if (!billingResult.success) {
      return {
        success: false,
        error: billingResult.error
      };
    }

    // Prepare update data for booking record
    const updateData = {
      status: 'PAYMENT_PENDING',               // Set status to PAYMENT_PENDING for cash payments
      endTime: endTime,                        // Record when charging stopped
      durationMinutes: billingResult.duration, // Store actual duration for analytics
      roundedDurationMinutes: billingResult.roundedDuration, // Store rounded duration
      finalAmount: billingResult.totalAmount,  // Store calculated final amount
      updatedAt: new Date()                    // Update the lastModified timestamp
    };

    // Update booking in storage
    if (mockMode) {
      // Mock mode: merge updates into existing booking object
      Object.assign(booking, updateData);
      mockBookings.set(bookingId, booking);
    } else {
      // Firestore: update document in database
      await db.collection('bookings').doc(bookingId).update(updateData);
      booking = { ...booking, ...updateData };
    }

    // Initialize cash payment tracking
    const paymentInit = await initializeCashPayment(bookingId, booking);
    if (!paymentInit.success) {
      console.warn(`Failed to initialize cash payment tracking for booking ${bookingId}: ${paymentInit.error}`);
      // Continue anyway, as the session is technically complete
    }

    // Return success response with calculated amount and updated booking
    return {
      success: true,
      finalAmount: billingResult.totalAmount,
      durationMinutes: billingResult.duration,
      roundedDurationMinutes: billingResult.roundedDuration,
      billing: billingResult.details,
      booking: booking,
      paymentTracking: paymentInit.success ? 'initialized' : 'failed'
    };
  } catch (error) {
    // Catch and log any errors that occur during processing
    console.error('Error stopping charging:', error);
    return {
      success: false,
      error: 'Failed to stop charging'
    };
  }
}

module.exports = {
  createBooking,
  startCharging,
  stopCharging
};