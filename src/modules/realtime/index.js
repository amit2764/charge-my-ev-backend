// Realtime (Socket.io) session handlers - initialize with server
const socketio = require('socket.io');
const logger = require('../../lib/logger');

function initRealtime(server) {
  const io = socketio(server, { path: '/ws' });
  const sessionNs = io.of('/session');

  sessionNs.on('connection', socket => {
    logger.info('socket connected', { id: socket.id });
    socket.on('join', ({ bookingId }) => {
      socket.join(bookingId);
    });
    socket.on('disconnect', () => {
      logger.info('socket disconnected', { id: socket.id });
    });
  });

  return io;
}

module.exports = { initRealtime };
