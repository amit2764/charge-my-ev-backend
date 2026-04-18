const { Server } = require('socket.io');

let io;
const hostSocketCounts = new Map();

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
      const { userId, requestId, hostId } = data || {};
      
      if (userId) {
        socket.join(`user:${userId}`);
        socket.join(`user_${userId}`);
        console.log(`[Socket] User ${userId} joined their personal room`);
      }
      
      if (requestId) {
        socket.join(`request:${requestId}`);
        socket.join(`request_${requestId}`);
        console.log(`[Socket] Client joined request room: request_${requestId}`);
      }

      if (hostId) {
        socket.data.hostId = hostId;
        socket.join(`host:${hostId}`);
        socket.join('hosts:online');
        hostSocketCounts.set(hostId, (hostSocketCounts.get(hostId) || 0) + 1);
        console.log(`[Socket] Host ${hostId} is online`);
      }
    });

    socket.on('disconnect', () => {
      const { hostId } = socket.data || {};
      if (hostId) {
        const left = (hostSocketCounts.get(hostId) || 1) - 1;
        if (left <= 0) {
          hostSocketCounts.delete(hostId);
          console.log(`[Socket] Host ${hostId} is offline`);
        } else {
          hostSocketCounts.set(hostId, left);
        }
      }
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
  io.to(`user_${userId}`).emit(event, data);
}

function emitToRequest(requestId, event, data) {
  if (!io) return;
  io.to(`request:${requestId}`).emit(event, data);
  io.to(`request_${requestId}`).emit(event, data);
}

function emitToHost(hostId, event, data) {
  if (!io) return;
  io.to(`host:${hostId}`).emit(event, data);
}

function emitToHostsOnline(event, data) {
  if (!io) return;
  io.to('hosts:online').emit(event, data);
}

function isHostOnline(hostId) {
  return (hostSocketCounts.get(hostId) || 0) > 0;
}

module.exports = {
  initializeWebSocketServer,
  emitToUser,
  emitToRequest,
  emitToHost,
  emitToHostsOnline,
  isHostOnline,
  getIO: () => io
};