/**
 * Online Payment Module (Razorpay Integration)
 * Handles order creation, payment verification, and host payouts.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { db, mockMode } = require('./config/firebase');

// Initialize Razorpay only if keys are present
let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

/**
 * Creates a Razorpay order for a completed charging session
 * @param {string} bookingId 
 * @param {number} amountInINR 
 */
async function createPaymentOrder(bookingId, amountInINR) {
  try {
    if (mockMode || !razorpayInstance) {
      console.log(`[PAYMENT] Mocking Razorpay order for ${bookingId}`);
      return { success: true, orderId: `order_mock_${Date.now()}`, amount: amountInINR * 100, currency: 'INR' };
    }

    const options = {
      amount: Math.round(amountInINR * 100), // Razorpay expects amount in paise
      currency: 'INR',
      receipt: bookingId,
      payment_capture: 1
    };

    const order = await razorpayInstance.orders.create(options);
    
    // Save order intent in Firestore
    await db.collection('online_payments').doc(bookingId).set({
      bookingId,
      orderId: order.id,
      amount: amountInINR,
      status: 'CREATED',
      createdAt: new Date()
    });

    return { success: true, orderId: order.id, amount: order.amount, currency: order.currency };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return { success: false, error: 'Failed to create payment order' };
  }
}

/**
 * Verifies the payment signature returned by the Razorpay frontend SDK
 * @param {string} bookingId 
 * @param {string} razorpayOrderId 
 * @param {string} razorpayPaymentId 
 * @param {string} signature 
 */
async function verifyPaymentSignature(bookingId, razorpayOrderId, razorpayPaymentId, signature) {
  try {
    if (mockMode || !razorpayInstance) {
      return { success: true, message: 'Mock payment verified successfully' };
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return { success: false, error: 'Invalid payment signature' };
    }

    // Update payment record
    await db.collection('online_payments').doc(bookingId).update({
      status: 'PAID',
      paymentId: razorpayPaymentId,
      paidAt: new Date()
    });

    // Update booking status
    await db.collection('bookings').doc(bookingId).update({
      status: 'PAID',
      updatedAt: new Date()
    });

    return { success: true, message: 'Payment verified successfully' };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return { success: false, error: 'Payment verification failed' };
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentSignature
};