const express = require('express');

async function createRequest(req, res) {
  // stub: validate + create request
  res.json({ success: true, request: { id: 'req_stub_1' } });
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/request', createRequest);
  app.use('/api', router);
}

module.exports = { registerRoutes };
