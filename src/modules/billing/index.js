// Billing module (stubs)
async function calculateBilling(booking) {
  // compute final amount
  return { finalAmount: 0 };
}

function registerRoutes(app) {
  // no direct public routes for billing (background jobs)
}

module.exports = { calculateBilling, registerRoutes };
