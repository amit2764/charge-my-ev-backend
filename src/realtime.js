/**
 * Real-Time Updates Module
 * Provides real-time capabilities for EV charging system
 */

const { Server } = require('socket.io');
const { db } = require('./config/firebase');

// Socket.io server instance
let io = null;

/**
 * Initialize Socket.io server
 * @param {http.Server} server - HTTP server instance
 */
function initializeWebSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    path: '/ws'
  });

  io.on('connection', (socket) => {
    console.log(`Client connected to Realtime Service: ${socket.id}`);

    // Handle incoming messages
    socket.on('subscribe', (data) => {
      try {
        handleSubscription(socket, data);
      } catch (error) {
        console.error('Socket subscription error:', error);
        socket.emit('error', {
          type: 'error',
          error: 'Invalid subscription data'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Clean up subscriptions if needed
      if (socket.responsesUnsubscribe) socket.responsesUnsubscribe();
      if (socket.bookingsUnsubscribe) socket.bookingsUnsubscribe();
      if (socket.bookingUnsubscribe) socket.bookingUnsubscribe();
    });

    // Send welcome message
    socket.emit('connected', {
      type: 'connected',
      message: 'Connected to EV charging real-time service'
    });
  });

  console.log('Socket.io server initialized');
}

/**
 * Handle client subscription requests
 * @param {import('socket.io').Socket} socket - Socket connection
 * @param {Object} data - Subscription data
 */
function handleSubscription(socket, data) {
  const { userId, requestId, bookingId } = data;

  if (!userId) {
    socket.emit('error', {
      type: 'error',
      error: 'userId required for subscription'
    });
    return;
  }

  // Join a dedicated room for this user to easily target them later
  socket.join(`user:${userId}`);
  if (bookingId) socket.join(`booking:${bookingId}`);

  socket.emit('subscribed', {
    type: 'subscribed',
    subscriptions: { userId, requestId, bookingId }
  });

  // Set up Firestore listeners for this client
  setupFirestoreListeners(socket, userId, requestId, bookingId);
}

/**
 * Set up Firestore real-time listeners for a client
 * @param {import('socket.io').Socket} socket - Socket connection
 * @param {string} userId - User ID
 * @param {string} requestId - Request ID (optional)
 * @param {string} bookingId - Booking ID (optional)
 */
function setupFirestoreListeners(socket, userId, requestId, bookingId) {
  // Listener for host responses to user's requests
  if (requestId) {
    const responsesUnsubscribe = db.collection('host_responses')
      .where('requestId', '==', requestId)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const response = {
            id: change.doc.id,
            ...change.doc.data()
          };

        socket.emit('response_update', {
            type: 'response_update',
            action: change.type, // 'added', 'modified', 'removed'
            response: response
        });
        });
      }, (error) => {
        console.error('Responses listener error:', error);
        socket.emit('error', {
          type: 'error',
          error: 'Failed to listen for responses'
      });

    // Store unsubscribe function for cleanup
    socket.responsesUnsubscribe = responsesUnsubscribe;
  }

  // Listener for user's bookings
  const bookingsUnsubscribe = db.collection('bookings')
    .where('userId', '==', userId)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const booking = {
          id: change.doc.id,
          ...change.doc.data()
        };

      socket.emit('booking_update', {
          type: 'booking_update',
          action: change.type,
          booking: booking
      });
      });
    }, (error) => {
      console.error('Bookings listener error:', error);
        socket.emit('error', {
        type: 'error',
        error: 'Failed to listen for bookings'
    });

  // Store unsubscribe function
  socket.bookingsUnsubscribe = bookingsUnsubscribe;

  // Listener for specific booking if provided
  if (bookingId) {
    const bookingUnsubscribe = db.collection('bookings').doc(bookingId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const booking = {
            id: doc.id,
            ...doc.data()
          };

        socket.emit('booking_detail_update', {
            type: 'booking_detail_update',
            booking: booking
        });
        }
      }, (error) => {
        console.error('Booking detail listener error:', error);
        socket.emit('error', {
          type: 'error',
          error: 'Failed to listen for booking details'
      });

    socket.bookingUnsubscribe = bookingUnsubscribe;
  }
}

/**
 * Broadcast updates to all connected clients
 * @param {string} type - Update type
 * @param {Object} data - Update data
 */
function broadcastUpdate(type, data) {
  if (!io) return;

  io.emit(type, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Send update to specific user
 * @param {string} userId - Target user ID
 * @param {string} type - Update type
 * @param {Object} data - Update data
 */
function sendToUser(userId, type, data) {
  if (!io) return;

  io.to(`user:${userId}`).emit(type, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Clean up Socket.io server
 */
function cleanup() {
  if (io) {
    io.close();
  }
}

module.exports = {
  initializeWebSocketServer,
  broadcastUpdate,
  sendToUser,
  cleanup
};