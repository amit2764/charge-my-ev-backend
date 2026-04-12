const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const logger = require('./lib/logger');

// Module route registrations
const authModule = require('./modules/auth');
const requestModule = require('./modules/request');
const matchingModule = require('./modules/matching');
const bookingModule = require('./modules/booking');
const sessionModule = require('./modules/session');
const paymentModule = require('./modules/payment');
const trustModule = require('./modules/trust');
const notificationsModule = require('./modules/notifications');
const adminModule = require('./modules/admin');

const app = express();
app.use(bodyParser.json());

// Basic health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Register module routes
if (authModule.registerRoutes) authModule.registerRoutes(app);
if (requestModule.registerRoutes) requestModule.registerRoutes(app);
if (matchingModule.registerRoutes) matchingModule.registerRoutes(app);
if (bookingModule.registerRoutes) bookingModule.registerRoutes(app);
if (sessionModule.registerRoutes) sessionModule.registerRoutes(app);
if (paymentModule.registerRoutes) paymentModule.registerRoutes(app);
if (trustModule.registerRoutes) trustModule.registerRoutes(app);
if (notificationsModule.registerRoutes) notificationsModule.registerRoutes(app);
if (adminModule.registerRoutes) adminModule.registerRoutes(app);

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: 'Internal Server Error' });
});

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});

module.exports = { app, server };
