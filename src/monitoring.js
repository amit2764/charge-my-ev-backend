/**
 * Monitoring and Alerting System
 * Tracks API failures, OTP errors, booking failures, and session issues
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'monitoring.log');
const ALERT_LOG_FILE = path.join(LOG_DIR, 'alerts.log');

// Alert thresholds (configurable)
const ALERT_THRESHOLDS = {
  API_FAILURES_PER_HOUR: 10,
  OTP_ERRORS_PER_HOUR: 5,
  BOOKING_FAILURES_PER_HOUR: 3,
  SESSION_ISSUES_PER_HOUR: 5,
  MAX_LOG_SIZE_MB: 10
};

// In-memory metrics storage (resets every hour)
let metrics = {
  apiFailures: [],
  otpErrors: [],
  bookingFailures: [],
  sessionIssues: [],
  lastReset: Date.now()
};

// Alert configuration
const ALERT_CONFIG = {
  EMAIL_ENABLED: process.env.ALERT_EMAIL_ENABLED === 'true',
  EMAIL_TO: process.env.ALERT_EMAIL_TO || 'admin@example.com',
  EMAIL_FROM: process.env.ALERT_EMAIL_FROM || 'noreply@evcharging.com',
  CONSOLE_ALERTS: true,
  LOG_ALERTS: true
};

/**
 * Initialize monitoring system
 */
async function initializeMonitoring() {
  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Check log file size and rotate if needed
    await checkLogRotation();

    console.log('✅ Monitoring system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize monitoring:', error);
  }
}

/**
 * Check and rotate log files if they exceed size limit
 */
async function checkLogRotation() {
  try {
    const stats = await fs.stat(LOG_FILE).catch(() => null);
    if (stats && stats.size > ALERT_THRESHOLDS.MAX_LOG_SIZE_MB * 1024 * 1024) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${LOG_FILE}.${timestamp}.bak`;
      await fs.rename(LOG_FILE, backupFile);
      console.log(`📄 Log rotated: ${backupFile}`);
    }
  } catch (error) {
    console.error('Log rotation error:', error);
  }
}

/**
 * Reset hourly metrics
 */
function resetMetricsIfNeeded() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  if (now - metrics.lastReset > oneHour) {
    metrics = {
      apiFailures: [],
      otpErrors: [],
      bookingFailures: [],
      sessionIssues: [],
      lastReset: now
    };
  }
}

/**
 * Log an event with structured data
 * @param {string} level - Log level (INFO, WARN, ERROR, CRITICAL)
 * @param {string} category - Category (API, OTP, BOOKING, SESSION)
 * @param {string} message - Log message
 * @param {object} data - Additional data
 */
async function logEvent(level, category, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    category,
    message,
    data,
    processId: process.pid
  };

  // Console output with color coding
  const colors = {
    INFO: '\x1b[36m',    // Cyan
    WARN: '\x1b[33m',    // Yellow
    ERROR: '\x1b[31m',   // Red
    CRITICAL: '\x1b[35m' // Magenta
  };
  const resetColor = '\x1b[0m';

  console.log(`${colors[level] || ''}[${timestamp}] ${level} [${category}] ${message}${resetColor}`);

  // Write to log file
  try {
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(LOG_FILE, logLine);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }

  // Check for alerts
  await checkForAlerts(category, level, data);
}

/**
 * Track API failure
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {number} statusCode - HTTP status code
 * @param {string} error - Error message
 * @param {object} requestData - Request data
 */
async function trackApiFailure(endpoint, method, statusCode, error, requestData = {}) {
  resetMetricsIfNeeded();

  const failure = {
    endpoint,
    method,
    statusCode,
    error,
    requestData,
    timestamp: Date.now()
  };

  metrics.apiFailures.push(failure);

  await logEvent('ERROR', 'API', `API failure: ${method} ${endpoint} (${statusCode})`, {
    endpoint,
    method,
    statusCode,
    error,
    requestData
  });
}

/**
 * Track OTP error
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} errorType - Type of OTP error
 * @param {string} details - Error details
 */
async function trackOtpError(userId, sessionId, errorType, details = '') {
  resetMetricsIfNeeded();

  const error = {
    userId,
    sessionId,
    errorType,
    details,
    timestamp: Date.now()
  };

  metrics.otpErrors.push(error);

  await logEvent('ERROR', 'OTP', `OTP error: ${errorType} for user ${userId}`, {
    userId,
    sessionId,
    errorType,
    details
  });
}

/**
 * Track booking failure
 * @param {string} userId - User ID
 * @param {string} hostId - Host ID
 * @param {string} errorType - Type of booking error
 * @param {string} details - Error details
 * @param {object} bookingData - Booking attempt data
 */
async function trackBookingFailure(userId, hostId, errorType, details = '', bookingData = {}) {
  resetMetricsIfNeeded();

  const failure = {
    userId,
    hostId,
    errorType,
    details,
    bookingData,
    timestamp: Date.now()
  };

  metrics.bookingFailures.push(failure);

  await logEvent('ERROR', 'BOOKING', `Booking failure: ${errorType} (${userId} -> ${hostId})`, {
    userId,
    hostId,
    errorType,
    details,
    bookingData
  });
}

/**
 * Track session issue
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} issueType - Type of session issue
 * @param {string} details - Issue details
 * @param {object} sessionData - Session data
 */
async function trackSessionIssue(sessionId, userId, issueType, details = '', sessionData = {}) {
  resetMetricsIfNeeded();

  const issue = {
    sessionId,
    userId,
    issueType,
    details,
    sessionData,
    timestamp: Date.now()
  };

  metrics.sessionIssues.push(issue);

  await logEvent('WARN', 'SESSION', `Session issue: ${issueType} (${sessionId})`, {
    sessionId,
    userId,
    issueType,
    details,
    sessionData
  });
}

/**
 * Check for alert conditions and trigger alerts
 * @param {string} category - Error category
 * @param {string} level - Log level
 * @param {object} data - Event data
 */
async function checkForAlerts(category, level, data) {
  resetMetricsIfNeeded();

  let shouldAlert = false;
  let alertMessage = '';
  let alertLevel = 'WARN';

  // Check thresholds
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  switch (category) {
    case 'API':
      const recentApiFailures = metrics.apiFailures.filter(f => f.timestamp > oneHourAgo);
      if (recentApiFailures.length >= ALERT_THRESHOLDS.API_FAILURES_PER_HOUR) {
        shouldAlert = true;
        alertMessage = `High API failure rate: ${recentApiFailures.length} failures in last hour`;
        alertLevel = 'CRITICAL';
      }
      break;

    case 'OTP':
      const recentOtpErrors = metrics.otpErrors.filter(e => e.timestamp > oneHourAgo);
      if (recentOtpErrors.length >= ALERT_THRESHOLDS.OTP_ERRORS_PER_HOUR) {
        shouldAlert = true;
        alertMessage = `High OTP error rate: ${recentOtpErrors.length} errors in last hour`;
        alertLevel = 'ERROR';
      }
      break;

    case 'BOOKING':
      const recentBookingFailures = metrics.bookingFailures.filter(f => f.timestamp > oneHourAgo);
      if (recentBookingFailures.length >= ALERT_THRESHOLDS.BOOKING_FAILURES_PER_HOUR) {
        shouldAlert = true;
        alertMessage = `High booking failure rate: ${recentBookingFailures.length} failures in last hour`;
        alertLevel = 'ERROR';
      }
      break;

    case 'SESSION':
      const recentSessionIssues = metrics.sessionIssues.filter(i => i.timestamp > oneHourAgo);
      if (recentSessionIssues.length >= ALERT_THRESHOLDS.SESSION_ISSUES_PER_HOUR) {
        shouldAlert = true;
        alertMessage = `High session issue rate: ${recentSessionIssues.length} issues in last hour`;
        alertLevel = 'WARN';
      }
      break;
  }

  if (shouldAlert) {
    await triggerAlert(alertLevel, alertMessage, { category, data });
  }
}

/**
 * Trigger an alert
 * @param {string} level - Alert level
 * @param {string} message - Alert message
 * @param {object} data - Alert data
 */
async function triggerAlert(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const alertEntry = {
    timestamp,
    level,
    message,
    data
  };

  // Console alert
  if (ALERT_CONFIG.CONSOLE_ALERTS) {
    const colors = {
      WARN: '\x1b[33m⚠️ ',
      ERROR: '\x1b[31m❌ ',
      CRITICAL: '\x1b[35m🚨 '
    };
    const resetColor = '\x1b[0m';
    console.log(`${colors[level] || ''}ALERT: ${message}${resetColor}`);
  }

  // Log alert
  if (ALERT_CONFIG.LOG_ALERTS) {
    try {
      const alertLine = JSON.stringify(alertEntry) + '\n';
      await fs.appendFile(ALERT_LOG_FILE, alertLine);
    } catch (error) {
      console.error('Failed to write alert to log file:', error);
    }
  }

  // Email alert (if enabled)
  if (ALERT_CONFIG.EMAIL_ENABLED) {
    await sendEmailAlert(level, message, data);
  }
}

/**
 * Send email alert (placeholder for external email service)
 * @param {string} level - Alert level
 * @param {string} message - Alert message
 * @param {object} data - Alert data
 */
async function sendEmailAlert(level, message, data) {
  // Placeholder for email service integration
  // You can integrate with services like SendGrid, Mailgun, etc.
  console.log(`📧 Email alert would be sent: ${level} - ${message}`);

  // Example integration:
  /*
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: ALERT_CONFIG.EMAIL_TO,
    from: ALERT_CONFIG.EMAIL_FROM,
    subject: `EV Charging Alert: ${level}`,
    text: `Alert: ${message}\n\nData: ${JSON.stringify(data, null, 2)}`,
    html: `<strong>Alert: ${message}</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`
  };

  await sgMail.send(msg);
  */
}

/**
 * Get monitoring metrics
 * @returns {object} Current metrics
 */
function getMetrics() {
  resetMetricsIfNeeded();

  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  return {
    current: {
      apiFailures: metrics.apiFailures.length,
      otpErrors: metrics.otpErrors.length,
      bookingFailures: metrics.bookingFailures.length,
      sessionIssues: metrics.sessionIssues.length
    },
    lastHour: {
      apiFailures: metrics.apiFailures.filter(f => f.timestamp > oneHourAgo).length,
      otpErrors: metrics.otpErrors.filter(e => e.timestamp > oneHourAgo).length,
      bookingFailures: metrics.bookingFailures.filter(f => f.timestamp > oneHourAgo).length,
      sessionIssues: metrics.sessionIssues.filter(i => i.timestamp > oneHourAgo).length
    },
    thresholds: ALERT_THRESHOLDS,
    lastReset: new Date(metrics.lastReset).toISOString()
  };
}

/**
 * Get recent logs
 * @param {number} limit - Number of logs to return
 * @returns {Array} Recent log entries
 */
async function getRecentLogs(limit = 100) {
  try {
    const logContent = await fs.readFile(LOG_FILE, 'utf8');
    const lines = logContent.trim().split('\n');
    const logs = lines.slice(-limit).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
    return logs;
  } catch (error) {
    console.error('Failed to read logs:', error);
    return [];
  }
}

/**
 * Get recent alerts
 * @param {number} limit - Number of alerts to return
 * @returns {Array} Recent alert entries
 */
async function getRecentAlerts(limit = 50) {
  try {
    const alertContent = await fs.readFile(ALERT_LOG_FILE, 'utf8');
    const lines = alertContent.trim().split('\n');
    const alerts = lines.slice(-limit).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
    return alerts;
  } catch (error) {
    console.error('Failed to read alerts:', error);
    return [];
  }
}

module.exports = {
  initializeMonitoring,
  logEvent,
  trackApiFailure,
  trackOtpError,
  trackBookingFailure,
  trackSessionIssue,
  getMetrics,
  getRecentLogs,
  getRecentAlerts,
  ALERT_THRESHOLDS,
  ALERT_CONFIG
};