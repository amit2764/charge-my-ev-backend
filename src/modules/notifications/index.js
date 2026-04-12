const express = require('express');

async function sendBookingAccepted(userId, booking) {
  // stub: enqueue FCM send
}

function registerRoutes(app) {
  // admin/test route
  const router = express.Router();
  router.post('/notifications/test', (req,res)=>res.json({ok:true}));
  app.use('/api', router);
}

module.exports = { sendBookingAccepted, registerRoutes };
