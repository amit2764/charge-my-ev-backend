const dotenv = require('dotenv');
const { isUserVerified } = require('./auth');

dotenv.config();

function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  return phoneRegex.test(phone);
}

function validateLocation(location) {
  if (!location || typeof location !== 'object') return false;
  const { lat, lng } = location;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

function validateVehicleType(vehicleType) {
  if (!vehicleType || typeof vehicleType !== 'string') return false;
  const validTypes = ['sedan', 'suv', 'truck', 'motorcycle', 'electric', 'hybrid'];
  return validTypes.includes(vehicleType.toLowerCase());
}

function validatePrice(price) {
  return typeof price === 'number' && price >= 0;
}

function validateUserId(userId) {
  return typeof userId === 'string' && userId.trim().length > 0;
}

async function ensureVerifiedUser(userId) {
  if (!validateUserId(userId)) {
    return {
      success: false,
      error: 'Valid userId is required'
    };
  }

  const verifiedResult = await isUserVerified(userId);
  if (!verifiedResult.success) {
    return verifiedResult;
  }

  if (!verifiedResult.verified) {
    return {
      success: false,
      error: 'User must verify their phone number before making requests'
    };
  }

  return {
    success: true
  };
}

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  const requestKey = req.header('x-admin-key') || req.query.adminKey || req.body.adminKey;

  if (!adminKey) {
    return res.status(500).json({
      success: false,
      error: 'Server misconfiguration: ADMIN_API_KEY is required for admin endpoints'
    });
  }

  if (!requestKey || requestKey !== adminKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized admin access'
    });
  }

  next();
}

module.exports = {
  validatePhone,
  validateLocation,
  validateVehicleType,
  validatePrice,
  validateUserId,
  ensureVerifiedUser,
  requireAdmin
};
