/**
 * Trust Scoring System Module
 * Calculates user trustworthiness score based on behavior metrics
 */

const { db, mockMode } = require('./config/firebase');

// Mock storage for user trust profiles
let mockTrustProfiles = new Map();

// Simple in-memory cache for trust profiles (for scaling)
const trustProfileCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Get cached trust profile or fetch from database
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Cached profile or null
 */
function getCachedTrustProfile(userId) {
  const cached = trustProfileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

/**
 * Set trust profile in cache
 * @param {string} userId - User ID
 * @param {object} profile - Profile data
 */
function setCachedTrustProfile(userId, profile) {
  trustProfileCache.set(userId, {
    data: profile,
    timestamp: Date.now()
  });

  // Clean up old cache entries periodically
  if (trustProfileCache.size > 1000) { // Arbitrary limit
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [key, value] of trustProfileCache) {
      if (value.timestamp < cutoff) {
        trustProfileCache.delete(key);
      }
    }
  }
}

/**
 * Trust score configuration and thresholds
 */
const CONFIG = {
  // Score weights (total: 100)
  COMPLETION_RATE_WEIGHT: 25,      // 25 points max for completion rate
  CANCELLATION_RATE_WEIGHT: 20,    // 20 points max for cancellation rate
  PAYMENT_RELIABILITY_WEIGHT: 25,  // 25 points max for payment reliability
  RESPONSE_TIME_WEIGHT: 15,        // 15 points max for response time
  RATINGS_WEIGHT: 15,              // 15 points max for ratings

  // Trust level thresholds
  TRUST_LEVELS: {
    EXCELLENT: { min: 85, label: 'Excellent', color: 'green' },
    GOOD: { min: 70, label: 'Good', color: 'blue' },
    FAIR: { min: 50, label: 'Fair', color: 'yellow' },
    POOR: { min: 0, label: 'Poor', color: 'red' }
  },

  // Response time thresholds (in minutes)
  RESPONSE_TIME_THRESHOLDS: {
    EXCELLENT: 30,  // < 30 minutes
    GOOD: 120,      // < 2 hours
    FAIR: 480,      // < 8 hours
    POOR: 1440      // > 24 hours
  }
};

/**
 * Calculate trust score from user metrics
 * @param {object} metrics - User metrics object
 * @param {number} metrics.completionRate - Percentage of completed bookings (0-100)
 * @param {number} metrics.cancellationRate - Percentage of cancelled bookings (0-100)
 * @param {number} metrics.paymentReliability - Percentage of reliable payments (0-100)
 * @param {number} metrics.averageResponseTime - Average response time in minutes
 * @param {number} metrics.averageRating - Average rating from 1-5 stars
 * @returns {object} Trust score calculation details
 */
function calculateTrustScore(metrics) {
  try {
    // Validate inputs
    if (!metrics || typeof metrics !== 'object') {
      return {
        success: false,
        error: 'Metrics object is required'
      };
    }

    const {
      completionRate = 0,
      cancellationRate = 0,
      paymentReliability = 0,
      averageResponseTime = 0,
      averageRating = 0
    } = metrics;

    // Validate metric ranges
    if (completionRate < 0 || completionRate > 100) {
      return {
        success: false,
        error: 'Completion rate must be between 0 and 100'
      };
    }

    if (cancellationRate < 0 || cancellationRate > 100) {
      return {
        success: false,
        error: 'Cancellation rate must be between 0 and 100'
      };
    }

    if (paymentReliability < 0 || paymentReliability > 100) {
      return {
        success: false,
        error: 'Payment reliability must be between 0 and 100'
      };
    }

    if (averageResponseTime < 0) {
      return {
        success: false,
        error: 'Average response time must be non-negative'
      };
    }

    if (averageRating < 0 || averageRating > 5) {
      return {
        success: false,
        error: 'Average rating must be between 0 and 5'
      };
    }

    // Calculate component scores

    // 1. Completion rate score (0-25 points)
    // More completed bookings = higher trust
    const completionScore = (completionRate / 100) * CONFIG.COMPLETION_RATE_WEIGHT;

    // 2. Cancellation rate score (0-20 points)
    // Lower cancellation rate = higher trust
    // Invert: 0% cancellation = 20 points, 100% cancellation = 0 points
    const cancellationScore = ((100 - cancellationRate) / 100) * CONFIG.CANCELLATION_RATE_WEIGHT;

    // 3. Payment reliability score (0-25 points)
    // Higher payment reliability = higher trust
    const paymentScore = (paymentReliability / 100) * CONFIG.PAYMENT_RELIABILITY_WEIGHT;

    // 4. Response time score (0-15 points)
    // Faster response time = higher trust
    const responseTimeScore = calculateResponseTimeScore(averageResponseTime);

    // 5. Ratings score (0-15 points)
    // Higher average rating = higher trust
    // 5.0 stars = 15 points, 0 stars = 0 points
    const ratingsScore = (averageRating / 5) * CONFIG.RATINGS_WEIGHT;

    // Calculate total trust score (0-100)
    const trustScore = Math.round(completionScore + cancellationScore + paymentScore + responseTimeScore + ratingsScore);

    // Clamp to 0-100 range
    const finalScore = Math.max(0, Math.min(100, trustScore));

    // Determine trust level
    let trustLevel = CONFIG.TRUST_LEVELS.POOR;
    for (const [key, level] of Object.entries(CONFIG.TRUST_LEVELS)) {
      if (finalScore >= level.min) {
        trustLevel = level;
        break;
      }
    }

    return {
      success: true,
      trustScore: finalScore,
      trustLevel: trustLevel.label,
      color: trustLevel.color,
      breakdown: {
        completionScore: Math.round(completionScore),
        cancellationScore: Math.round(cancellationScore),
        paymentScore: Math.round(paymentScore),
        responseTimeScore: Math.round(responseTimeScore),
        ratingsScore: Math.round(ratingsScore)
      },
      metrics: {
        completionRate,
        cancellationRate,
        paymentReliability,
        averageResponseTime,
        averageRating
      },
      calculation: {
        completionRate: `${completionRate}% × ${CONFIG.COMPLETION_RATE_WEIGHT}% = ${Math.round(completionScore)}pts`,
        cancellationRate: `(100 - ${cancellationRate}%) × ${CONFIG.CANCELLATION_RATE_WEIGHT}% = ${Math.round(cancellationScore)}pts`,
        paymentReliability: `${paymentReliability}% × ${CONFIG.PAYMENT_RELIABILITY_WEIGHT}% = ${Math.round(paymentScore)}pts`,
        responseTime: `${averageResponseTime}min → ${Math.round(responseTimeScore)}pts`,
        averageRating: `${averageRating} / 5 × ${CONFIG.RATINGS_WEIGHT}% = ${Math.round(ratingsScore)}pts`
      }
    };
  } catch (error) {
    console.error('Error calculating trust score:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create or update trust profile for a user
 * @param {string} userId - User ID
 * @param {object} metrics - User metrics (optional - will calculate if not provided)
 * @returns {Promise<object>} Created/updated trust profile
 */
async function updateUserTrustScore(userId, metrics = null) {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'userId is required'
      };
    }

    // If metrics not provided, calculate them automatically
    if (!metrics) {
      metrics = await calculateUserMetrics(userId);
    }

    // Calculate trust score
    const scoreResult = calculateTrustScore(metrics);
    if (!scoreResult.success) {
      return scoreResult;
    }

    const trustProfile = {
      userId,
      trustScore: scoreResult.trustScore,
      trustLevel: scoreResult.trustLevel,
      metrics: scoreResult.metrics,
      breakdown: scoreResult.breakdown,
      updatedAt: new Date(),
      createdAt: new Date() // Will be updated if profile exists
    };

    if (mockMode) {
      // Mock mode: update or create in Map
      if (mockTrustProfiles.has(userId)) {
        const existing = mockTrustProfiles.get(userId);
        trustProfile.createdAt = existing.createdAt;
      }
      mockTrustProfiles.set(userId, trustProfile);
    } else {
      // Firestore: update or create document
      await db.collection('trust_profiles').doc(userId).set(trustProfile, { merge: true });
    }

    // Invalidate cache for this user
    trustProfileCache.delete(userId);

    return {
      success: true,
      profile: trustProfile
    };
  } catch (error) {
    console.error('Error updating trust score:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get trust profile for a user with caching
 * @param {string} userId - User ID
 * @returns {Promise<object>} User trust profile
 */
async function getUserTrustProfile(userId) {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'userId is required'
      };
    }

    // Check cache first
    const cached = getCachedTrustProfile(userId);
    if (cached) {
      return {
        success: true,
        profile: { id: userId, ...cached }
      };
    }

    let profile = null;

    if (mockMode) {
      // Mock mode: get from Map
      profile = mockTrustProfiles.get(userId);
    } else {
      // Firestore: get document
      const doc = await db.collection('trust_profiles').doc(userId).get();
      if (doc.exists) {
        profile = { id: doc.id, ...doc.data() };
        // Cache the profile
        setCachedTrustProfile(userId, doc.data());
      }
    }

    if (!profile) {
      return {
        success: false,
        error: 'Trust profile not found for user'
      };
    }

    return {
      success: true,
      profile
    };
  } catch (error) {
    console.error('Error getting trust profile:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get trust profiles for multiple users with batching optimization and caching
 * @param {array} userIds - Array of user IDs
 * @returns {Promise<object>} Map of trust profiles
 */
async function getUsersTrustProfiles(userIds) {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return {
        success: false,
        error: 'userIds must be a non-empty array'
      };
    }

    const profiles = [];
    const uncachedUserIds = [];

    // Check cache first
    for (const userId of userIds) {
      const cached = getCachedTrustProfile(userId);
      if (cached) {
        profiles.push({ userId, ...cached });
      } else {
        uncachedUserIds.push(userId);
      }
    }

    // Fetch uncached profiles
    if (uncachedUserIds.length > 0) {
      if (mockMode) {
        // Mock mode: get from Map
        for (const userId of uncachedUserIds) {
          const profile = mockTrustProfiles.get(userId);
          if (profile) {
            profiles.push({ userId, ...profile });
            setCachedTrustProfile(userId, profile);
          }
        }
      } else {
        // Production: Batch document fetches for better performance
        const BATCH_SIZE = 10;

        for (let i = 0; i < uncachedUserIds.length; i += BATCH_SIZE) {
          const batch = uncachedUserIds.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(userId =>
            db.collection('trust_profiles').doc(userId).get()
          );

          const batchResults = await Promise.all(batchPromises);

          batchResults.forEach((doc, index) => {
            if (doc.exists) {
              const profile = doc.data();
              profiles.push({ userId: batch[index], ...profile });
              setCachedTrustProfile(batch[index], profile);
            }
          });

          // Small delay between batches to prevent overwhelming Firestore
          if (i + BATCH_SIZE < uncachedUserIds.length) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }
    }

    return {
      success: true,
      count: profiles.length,
      profiles
    };
  } catch (error) {
    console.error('Error getting trust profiles:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all trust profiles (for analytics/admin)
 * @returns {Promise<object>} All trust profiles with statistics
 */
async function getAllTrustProfiles() {
  try {
    let profiles = [];

    if (mockMode) {
      // Mock mode: get all from Map
      for (const [userId, profile] of mockTrustProfiles) {
        profiles.push({ userId, ...profile });
      }
    } else {
      // Firestore: query all documents
      const snapshot = await db.collection('trust_profiles').get();
      snapshot.forEach(doc => {
        profiles.push({ userId: doc.id, ...doc.data() });
      });
    }

    // Calculate statistics
    let stats = {
      totalUsers: profiles.length,
      averageTrustScore: 0,
      trustLevelDistribution: {}
    };

    if (profiles.length > 0) {
      const totalScore = profiles.reduce((sum, p) => sum + p.trustScore, 0);
      stats.averageTrustScore = Math.round(totalScore / profiles.length);

      // Count by trust level
      for (const level of Object.values(CONFIG.TRUST_LEVELS)) {
        stats.trustLevelDistribution[level.label] = 0;
      }
      for (const profile of profiles) {
        stats.trustLevelDistribution[profile.trustLevel]++;
      }
    }

    return {
      success: true,
      stats,
      profiles
    };
  } catch (error) {
    console.error('Error getting all trust profiles:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate response time score based on average response time
 * @param {number} averageResponseTime - Average response time in minutes
 * @returns {number} Response time score (0-15 points)
 */
function calculateResponseTimeScore(averageResponseTime) {
  if (averageResponseTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.EXCELLENT) {
    return CONFIG.RESPONSE_TIME_WEIGHT; // 15 points for < 30 minutes
  } else if (averageResponseTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.GOOD) {
    return CONFIG.RESPONSE_TIME_WEIGHT * 0.8; // 12 points for < 2 hours
  } else if (averageResponseTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.FAIR) {
    return CONFIG.RESPONSE_TIME_WEIGHT * 0.6; // 9 points for < 8 hours
  } else if (averageResponseTime <= CONFIG.RESPONSE_TIME_THRESHOLDS.POOR) {
    return CONFIG.RESPONSE_TIME_WEIGHT * 0.3; // 4.5 points for < 24 hours
  } else {
    return 0; // 0 points for > 24 hours
  }
}

/**
 * Calculate payment reliability for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Payment reliability percentage (0-100)
 */
async function calculatePaymentReliability(userId) {
  try {
    if (mockMode) {
      // Mock data - return 85% for demo
      return 85;
    }

    // Get all cash payments where user is involved (as user)
    const userPayments = await db.collection('cash_payments')
      .where('userId', '==', userId)
      .where('status', 'in', ['CONFIRMED', 'RESOLVED'])
      .get();

    if (userPayments.empty) {
      return 100; // No payments = 100% reliability (neutral)
    }

    let totalPayments = 0;
    let reliablePayments = 0;

    userPayments.forEach(doc => {
      const payment = doc.data();
      totalPayments++;

      // Consider payment reliable if:
      // - Confirmed by both parties, OR
      // - Dispute resolved in user's favor, OR
      // - No dispute raised
      if (payment.status === 'CONFIRMED' ||
          (payment.status === 'RESOLVED' && payment.resolution !== 'USER_FAULT')) {
        reliablePayments++;
      }
    });

    return totalPayments > 0 ? Math.round((reliablePayments / totalPayments) * 100) : 100;

  } catch (error) {
    console.error('Error calculating payment reliability:', error);
    return 50; // Default to neutral on error
  }
}

/**
 * Calculate average response time for a user (as host)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Average response time in minutes
 */
async function calculateAverageResponseTime(userId) {
  try {
    if (mockMode) {
      // Mock data - return 45 minutes for demo
      return 45;
    }

    // Get all host responses for this user
    const responses = await db.collection('host_responses')
      .where('hostId', '==', userId)
      .get();

    if (responses.empty) {
      return CONFIG.RESPONSE_TIME_THRESHOLDS.POOR; // Default to poor if no responses
    }

    let totalResponseTime = 0;
    let responseCount = 0;

    responses.forEach(doc => {
      const response = doc.data();
      if (response.createdAt && response.requestCreatedAt) {
        // Calculate response time in minutes
        const responseTime = (response.createdAt.toDate() - response.requestCreatedAt.toDate()) / (1000 * 60);
        if (responseTime >= 0) { // Only count valid response times
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
    });

    return responseCount > 0 ? Math.round(totalResponseTime / responseCount) : CONFIG.RESPONSE_TIME_THRESHOLDS.POOR;

  } catch (error) {
    console.error('Error calculating average response time:', error);
    return CONFIG.RESPONSE_TIME_THRESHOLDS.POOR;
  }
}

/**
 * Calculate comprehensive user metrics including new factors
 * @param {string} userId - User ID
 * @returns {Promise<object>} Complete user metrics
 */
async function calculateUserMetrics(userId) {
  try {
    if (mockMode) {
      // Return mock metrics for testing
      return {
        completionRate: 85,
        cancellationRate: 5,
        paymentReliability: 90,
        averageResponseTime: 45,
        averageRating: 4.2
      };
    }

    // Get user's bookings
    const bookings = await db.collection('bookings')
      .where('userId', '==', userId)
      .get();

    let totalBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let totalRating = 0;
    let ratingCount = 0;

    bookings.forEach(doc => {
      const booking = doc.data();
      totalBookings++;

      if (booking.status === 'COMPLETED') {
        completedBookings++;
      } else if (booking.status === 'CANCELLED') {
        cancelledBookings++;
      }

      // Collect ratings (assuming ratings are stored in booking)
      if (booking.hostRating) {
        totalRating += booking.hostRating;
        ratingCount++;
      }
    });

    // Calculate basic metrics
    const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 100;
    const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0;
    const averageRating = ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0;

    // Calculate advanced metrics
    const paymentReliability = await calculatePaymentReliability(userId);
    const averageResponseTime = await calculateAverageResponseTime(userId);

    return {
      completionRate,
      cancellationRate,
      paymentReliability,
      averageResponseTime,
      averageRating
    };

  } catch (error) {
    console.error('Error calculating user metrics:', error);
    return {
      completionRate: 0,
      cancellationRate: 0,
      paymentReliability: 50,
      averageResponseTime: CONFIG.RESPONSE_TIME_THRESHOLDS.POOR,
      averageRating: 0
    };
  }
}

/**
 * Get user ranking based on trust score and activity
 * @param {string} userId - User ID
 * @returns {Promise<object>} User ranking information
 */
async function getUserRanking(userId) {
  try {
    // Get user's trust profile
    const profileResult = await getUserTrustProfile(userId);
    if (!profileResult.success) {
      return {
        success: false,
        error: 'Trust profile not found'
      };
    }

    const userProfile = profileResult.profile;

    // Get all trust profiles for comparison
    const allProfilesResult = await getAllTrustProfiles();
    if (!allProfilesResult.success) {
      return {
        success: false,
        error: 'Could not retrieve ranking data'
      };
    }

    const allProfiles = allProfilesResult.profiles;

    // Calculate ranking
    const userScore = userProfile.trustScore;
    const higherScores = allProfiles.filter(p => p.trustScore > userScore).length;
    const totalUsers = allProfiles.length;
    const rank = higherScores + 1;
    const percentile = totalUsers > 0 ? Math.round(((totalUsers - rank) / totalUsers) * 100) : 100;

    // Determine ranking tier
    let rankingTier;
    if (percentile >= 95) {
      rankingTier = 'TOP_5';
    } else if (percentile >= 90) {
      rankingTier = 'TOP_10';
    } else if (percentile >= 75) {
      rankingTier = 'TOP_25';
    } else if (percentile >= 50) {
      rankingTier = 'TOP_50';
    } else if (percentile >= 25) {
      rankingTier = 'BOTTOM_50';
    } else {
      rankingTier = 'BOTTOM_25';
    }

    // Calculate ranking benefits
    const benefits = getRankingBenefits(rankingTier, userProfile.trustLevel);

    return {
      success: true,
      ranking: {
        rank,
        totalUsers,
        percentile,
        tier: rankingTier,
        benefits
      },
      trustScore: userScore,
      trustLevel: userProfile.trustLevel
    };

  } catch (error) {
    console.error('Error getting user ranking:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get ranking benefits based on tier and trust level
 * @param {string} tier - Ranking tier
 * @param {string} trustLevel - Trust level
 * @returns {array} List of benefits
 */
function getRankingBenefits(tier, trustLevel) {
  const benefits = [];

  // Trust level benefits
  if (trustLevel === 'EXCELLENT') {
    benefits.push('Priority booking access', 'Higher credit limits', 'Exclusive discounts');
  } else if (trustLevel === 'GOOD') {
    benefits.push('Standard booking privileges', 'Normal credit limits');
  } else if (trustLevel === 'FAIR') {
    benefits.push('Basic booking access');
  } else {
    benefits.push('Limited booking access', 'Deposit required');
  }

  // Ranking tier benefits
  if (tier === 'TOP_5') {
    benefits.push('Featured in top hosts list', 'Premium support', 'Early access to new features');
  } else if (tier === 'TOP_10') {
    benefits.push('Highlighted in search results', 'Priority customer support');
  } else if (tier === 'TOP_25') {
    benefits.push('Improved search visibility', 'Standard support');
  }

  return [...new Set(benefits)]; // Remove duplicates
}

/**
 * Get top-ranked users for leaderboard with pagination
 * @param {number} limit - Number of users to return (default: 10)
 * @param {string} startAfter - Document ID to start after for pagination
 * @returns {Promise<object>} Top users leaderboard with pagination info
 */
async function getTopRankedUsers(limit = 10, startAfter = null) {
  try {
    // Validate limit for performance
    const maxLimit = 100; // Prevent excessive queries
    const actualLimit = Math.min(limit, maxLimit);

    let query = db.collection('trust_profiles')
      .orderBy('trustScore', 'desc')
      .orderBy('updatedAt', 'desc') // Secondary sort for consistency
      .limit(actualLimit);

    // Add pagination cursor if provided
    if (startAfter && mockMode === false) {
      const startAfterDoc = await db.collection('trust_profiles').doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();

    // Sort and slice for mock mode
    let profiles = [];
    if (mockMode) {
      profiles = Array.from(mockTrustProfiles.values())
        .sort((a, b) => {
          if (b.trustScore !== a.trustScore) {
            return b.trustScore - a.trustScore;
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        })
        .slice(0, actualLimit);
    } else {
      snapshot.forEach(doc => {
        profiles.push({ userId: doc.id, ...doc.data() });
      });
    }

    // Add ranking information
    const leaderboard = profiles.map((profile, index) => ({
      rank: startAfter ? (parseInt(startAfter.split('_')[1] || '0') + index + 1) : (index + 1),
      userId: profile.userId,
      trustScore: profile.trustScore,
      trustLevel: profile.trustLevel,
      metrics: profile.metrics
    }));

    // Get total count efficiently (avoid full collection scan)
    let totalUsers = leaderboard.length;
    if (!mockMode) {
      // Use aggregation or cached count for production
      const statsDoc = await db.collection('system_stats').doc('trust_profiles').get();
      if (statsDoc.exists) {
        totalUsers = statsDoc.data().totalCount || leaderboard.length;
      }
    } else {
      totalUsers = mockTrustProfiles.size;
    }

    return {
      success: true,
      leaderboard,
      pagination: {
        limit: actualLimit,
        hasMore: leaderboard.length === actualLimit,
        nextCursor: leaderboard.length > 0 ? leaderboard[leaderboard.length - 1].userId : null
      },
      totalUsers
    };

  } catch (error) {
    console.error('Error getting top ranked users:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get guidance based on trust score
 * @param {number} trustScore - Trust score (0-100)
 * @returns {object} Guidance object with level, description, and recommendations
 */
function getTrustScoreGuidance(trustScore) {
  if (trustScore >= 80) {
    return {
      level: 'EXCELLENT',
      description: 'Outstanding trust profile with excellent performance across all metrics.',
      recommendations: 'Continue maintaining high standards. Consider mentoring other users.'
    };
  } else if (trustScore >= 65) {
    return {
      level: 'GOOD',
      description: 'Strong trust profile with good performance. Reliable for most transactions.',
      recommendations: 'Keep up the good work. Focus on maintaining response times.'
    };
  } else if (trustScore >= 45) {
    return {
      level: 'FAIR',
      description: 'Average trust profile. Some areas need improvement.',
      recommendations: 'Work on improving completion rates and payment reliability.'
    };
  } else {
    return {
      level: 'POOR',
      description: 'Low trust profile. Significant improvements needed.',
      recommendations: 'Focus on completing bookings, paying promptly, and responding quickly.'
    };
  }
}

/**
 * Set multiple mock trust profiles (for testing)
 * @param {object} profiles - Object with userId keys and profile values
 */
function setMockTrustProfiles(profiles) {
  if (typeof profiles !== 'object') {
    throw new Error('profiles must be an object');
  }

  for (const [userId, profile] of Object.entries(profiles)) {
    mockTrustProfiles.set(userId, profile);
  }
}

/**
 * Clear all mock trust profiles (for testing)
 */
function clearMockTrustProfiles() {
  mockTrustProfiles.clear();
}

module.exports = {
  calculateTrustScore,
  updateUserTrustScore,
  getUserTrustProfile,
  getUsersTrustProfiles,
  getAllTrustProfiles,
  getTrustScoreGuidance,
  calculateUserMetrics,
  calculatePaymentReliability,
  calculateAverageResponseTime,
  getUserRanking,
  getTopRankedUsers,
  setMockTrustProfiles,
  clearMockTrustProfiles,
  CONFIG
};
