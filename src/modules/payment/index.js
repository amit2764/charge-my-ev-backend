const express = require('express');

async function createPaymentOrder(req, res) {
  res.json({ success: true, message: 'Create payment order (stub)' });
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/payments/create-order', createPaymentOrder);
  app.use('/api', router);
}

module.exports = { registerRoutes };
