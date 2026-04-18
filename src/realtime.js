const { Server } = require('socket.io');

let io;

function initializeWebSocketServer(server, options = {}) {
  io = new Server(server, {
    path: '/ws',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    ...options
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Handle frontend subscription (rooms)
    socket.on('subscribe', (data) => {
      const { userId, requestId } = data || {};
      
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`[Socket] User ${userId} joined their personal room`);
      }
      
      if (requestId) {
        socket.join(`request_${requestId}`);
        console.log(`[Socket] Client joined request room: request_${requestId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user_${userId}`).emit(event, data);
}

function emitToRequest(requestId, event, data) {
  if (io) io.to(`request_${requestId}`).emit(event, data);
}

module.exports = {
  initializeWebSocketServer,
  emitToUser,
  emitToRequest,
  getIO: () => io
};