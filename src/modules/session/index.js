const express = require('express');

async function startSession(req, res) {
  res.json({ success: true, message: 'Session started (stub)' });
}
async function stopSession(req, res) {
  res.json({ success: true, message: 'Session stopped (stub)' });
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/start', startSession);
  router.post('/stop', stopSession);
  app.use('/api', router);
}

module.exports = { registerRoutes };
