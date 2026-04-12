/**
 * Billing Logic Module
 * Handles billing calculations for EV charging sessions
 */

/**
 * Calculate total billing amount based on duration and hourly rate
 * 
 * @param {Date|number} startTime - Charging start time (Date object or timestamp)
 * @param {Date|number} endTime - Charging end time (Date object or timestamp)
 * @param {number} pricePerHour - Hourly charging rate in dollars
 * @param {number} bufferMinutes - Optional buffer time to add (default: 0)
 * @returns {object} - { duration, roundedDuration, totalAmount, details }
 */
function calculateBillingAmount(startTime, endTime, pricePerHour, bufferMinutes = 0) {
  try {
    // Validate inputs
    if (!startTime || !endTime || pricePerHour === undefined) {
      return {
        success: false,
        error: 'startTime, endTime, and pricePerHour are required'
      };
    }

    if (typeof pricePerHour !== 'number' || pricePerHour < 0) {
      return {
        success: false,
        error: 'pricePerHour must be a non-negative number'
      };
    }

    if (typeof bufferMinutes !== 'number' || bufferMinutes < 0) {
      return {
        success: false,
        error: 'bufferMinutes must be a non-negative number'
      };
    }

    // Convert timestamps to Date objects if necessary
    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const end = endTime instanceof Date ? endTime : new Date(endTime);

    // Validate that endTime is after startTime
    if (end <= start) {
      return {
        success: false,
        error: 'endTime must be after startTime'
      };
    }

    // Calculate raw duration in milliseconds
    const durationMs = end - start;

    // Convert milliseconds to minutes (keeping decimals for accuracy)
    const durationMinutes = durationMs / (1000 * 60);

    // Add optional buffer time in minutes
    const totalDurationMinutes = durationMinutes + bufferMinutes;

    // Round up to nearest 10 minutes
    // Formula: Math.ceil(value / 10) * 10
    // Examples:
    //   5 min → 10 min (Math.ceil(5/10) * 10 = 1 * 10 = 10)
    //   11 min → 20 min (Math.ceil(11/10) * 10 = 2 * 10 = 20)
    //   20 min → 20 min (Math.ceil(20/10) * 10 = 2 * 10 = 20)
    const roundedDurationMinutes = Math.ceil(totalDurationMinutes / 10) * 10;

    // Convert rounded duration from minutes to hours
    const roundedDurationHours = roundedDurationMinutes / 60;

    // Calculate total amount: hourly price × rounded duration in hours
    // Round to 2 decimal places for currency
    const totalAmount = Math.round(pricePerHour * roundedDurationHours * 100) / 100;

    // Return success with all billing details
    return {
      success: true,
      duration: Math.round(durationMinutes * 100) / 100,              // Actual duration in minutes
      roundedDuration: roundedDurationMinutes,                        // Rounded to nearest 10 min
      totalAmount: totalAmount,                                       // Final billing amount
      buffer: bufferMinutes,                                          // Buffer applied
      details: {
        pricePerHour: pricePerHour,
        actualDurationMinutes: Math.round(durationMinutes * 100) / 100,
        roundedDurationMinutes: roundedDurationMinutes,
        roundedDurationHours: parseFloat(roundedDurationHours.toFixed(2)),
        totalAmount: totalAmount,
        startTime: start.toISOString(),
        endTime: end.toISOString()
      }
    };
  } catch (error) {
    console.error('Error calculating billing amount:', error);
    return {
      success: false,
      error: 'Failed to calculate billing amount'
    };
  }
}

module.exports = {
  calculateBillingAmount
};