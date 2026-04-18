/**
 * Online Payment Module (Razorpay Integration)
 * Handles order creation, payment verification, and host payouts.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { db, mockMode } = require('./config/firebase');
const { sendEmail } = require('./email');

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

    const bookingRef = db.collection('bookings').doc(bookingId);
    // Update booking status
    await bookingRef.update({
      status: 'PAID',
      updatedAt: new Date()
    });

    // Send receipt email
    const paymentDoc = await db.collection('online_payments').doc(bookingId).get();
    const bookingDoc = await bookingRef.get();
    if (paymentDoc.exists && bookingDoc.exists) {
      const userPhone = bookingDoc.data().userId; // Assuming userId is the phone number
      const amount = paymentDoc.data().amount;
      // NOTE: Using a placeholder email address. In a real app, you'd collect the user's email.
      sendEmail(userPhone + '@example.com', `Your Payment Receipt for Booking #${bookingId.slice(-6)}`, `Thank you for your payment of INR ${amount}.`, `<h1>Payment Successful</h1><p>Thank you for your payment of INR ${amount} for booking ${bookingId}.</p>`);
    }

    return { success: true, message: 'Payment verified successfully' };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return { success: false, error: 'Payment verification failed' };
  }
}

/**
 * Processes incoming Razorpay webhooks
 * @param {string} rawBody 
 * @param {string} signature 
 */
async function processWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return { success: false, error: 'Webhook secret not configured' };

  try {
    // Generate HMAC SHA256 signature using the raw body and your webhook secret
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return { success: false, error: 'Invalid webhook signature' };
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // Process successful payment
    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      
      // Find the payment intent in Firestore
      const snapshot = await db.collection('online_payments')
        .where('orderId', '==', orderId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const bookingId = doc.data().bookingId;

        // Mark payment as paid via webhook
        await doc.ref.update({
          status: 'PAID',
          paymentId: payment.id,
          webhookCapturedAt: new Date()
        });

        // Mark the actual booking as paid
        const bookingRef = db.collection('bookings').doc(bookingId);
        await bookingRef.update({
          status: 'PAID',
          updatedAt: new Date()
        });
        
        // Send receipt email
        const bookingDoc = await bookingRef.get();
        if (bookingDoc.exists) {
          const userPhone = bookingDoc.data().userId;
          // NOTE: Using a placeholder email address. In a real app, you'd collect the user's email.
          sendEmail(userPhone + '@example.com', `Your Payment Receipt for Booking #${bookingId.slice(-6)}`, `Thank you for your payment of INR ${payment.amount / 100}.`, `<h1>Payment Successful</h1><p>Thank you for your payment of INR ${payment.amount / 100} for booking ${bookingId}.</p>`);
        }

        return { success: true, message: 'Payment captured via webhook successfully' };
      }
    }
    
    return { success: true, message: `Webhook received but ignored event: ${event}` };
  } catch (error) {
    console.error('Webhook processing error:', error);
    return { success: false, error: 'Internal webhook processing error' };
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentSignature,
  processWebhook
};