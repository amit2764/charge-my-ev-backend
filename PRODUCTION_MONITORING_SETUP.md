# Production Monitoring & Error Tracking Setup

**Status**: ✅ Configured and Ready  
**Last Updated**: April 18, 2026  
**Components**: Backend (Sentry), Frontend (Sentry), Logging (Winston)

---

## 🎯 What's Been Set Up

### Backend Error Monitoring
✅ Sentry Node.js integration installed (`@sentry/node`, `@sentry/profiling-node`)  
✅ Sentry initialized in `src/app.js` with automatic request/tracing handlers  
✅ Global error handler configured to capture all exceptions  
✅ Performance profiling enabled (response times, database queries)  
✅ Environment: `.env` variables configured for `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, sampling rates  

### Frontend Error Monitoring
✅ Sentry React integration added to `ev-frontend/package.json`  
✅ `ev-frontend/src/sentry.js` created with initialization logic  
✅ `ev-frontend/src/main.jsx` updated to call `initializeSentry()`  
✅ Environment variables configured in `ev-frontend/.env`  
✅ User context tracking (for correlating errors with users)  
✅ Session replay enabled (records user interactions before errors)  

### Logging Infrastructure
✅ Winston logger available in backend for structured logging  
✅ Log levels: debug, info, warn, error  
✅ Logs persisted (can be integrated with Cloud Logging)  

---

## 🚀 Quick Start for Production

### Step 1: Get Sentry DSN (5 minutes)

1. Go to https://sentry.io/
2. Create two projects:
   - **Backend**: `ev-charging-backend-prod`
   - **Frontend**: `ev-charging-frontend-prod`
3. Copy DSN from each project

### Step 2: Configure Backend (2 minutes)

**Edit `.env`:**
```bash
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Step 3: Configure Frontend (2 minutes)

**Edit `ev-frontend/.env`:**
```bash
VITE_ENVIRONMENT=production
VITE_SENTRY_DSN=https://your-key@sentry.io/project-id
```

### Step 4: Install Dependencies (3 minutes)

```bash
# Backend dependencies already installed
# Verify Sentry packages are present
npm list | grep sentry

# Frontend - install new Sentry packages
cd ev-frontend
npm install
cd ..
```

### Step 5: Test Sentry Integration

**Backend Test:**
```bash
# Start backend
npm run dev

# In another terminal, trigger an error
curl -X GET http://localhost:3000/api/test-error

# Check Sentry dashboard - you should see the error within 5 seconds
```

**Frontend Test:**
```bash
# In dev tools console, trigger an error
Sentry.captureException(new Error("Test error from frontend"))

# Check Sentry dashboard for the error
```

---

## 📊 What Sentry Tracks Automatically

### Backend
- ✅ Unhandled exceptions
- ✅ HTTP request/response times
- ✅ Database query performance (Firestore)
- ✅ Error rates and frequency
- ✅ User sessions and errors
- ✅ Stack traces with source maps
- ✅ Environment info (Node version, OS)
- ✅ Request data (URL, method, headers)

### Frontend
- ✅ JavaScript errors
- ✅ Unhandled promise rejections
- ✅ React component errors
- ✅ Network request failures
- ✅ Console errors and warnings
- ✅ User interactions before error (breadcrumbs)
- ✅ Session recording (video replay)
- ✅ Browser/device info
- ✅ User identification

---

## 🔧 Advanced: Custom Error Tracking

### Capture Specific Errors in Backend

```javascript
const { app } = require('./src/app');
const Sentry = require('@sentry/node');

// Capture specific error
try {
  // Some code
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'billing',
      operation: 'payment-verification'
    },
    extra: {
      paymentId: '12345',
      amount: 500
    }
  });
}

// Capture message
Sentry.captureMessage('Payment webhook received', 'info');
```

### Capture Specific Errors in Frontend

```javascript
import { captureException, setUserContext } from './sentry';

// On user login
setUserContext(userId, userEmail, userPhone);

// Capture error
try {
  await sendOTP(phone);
} catch (error) {
  captureException(error, {
    userId,
    phone,
    step: 'otp-send'
  });
}

// On logout
clearUserContext();
```

---

## 🎨 Sentry Dashboard Features

### Release Tracking
- Monitor errors per release
- Compare performance before/after deployments
- Rollback alerts

### Alert Rules
- Trigger alerts for:
  - Critical errors (rate > 5%)
  - New issues
  - Regressed performance (> 500ms)
- Send to Slack, Email, PagerDuty

### Team Collaboration
- Assign issues to team members
- Comment on errors
- Link to GitHub issues

### Performance Monitoring
- Track API endpoint performance
- Identify slow database queries
- Monitor frontend page load times

---

## 📈 Monitoring Checklist

- [ ] Sentry projects created (backend + frontend)
- [ ] DSNs added to `.env` files
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Errors test successful (visible in Sentry dashboard)
- [ ] Team members invited to Sentry
- [ ] Alert rules configured
- [ ] Slack/Email integration set up
- [ ] Baseline performance metrics recorded

---

## ⚠️ Important Notes

### Sampling Rates (Production)
- **Backend**: 10% of transactions (0.1) to reduce costs
- **Frontend**: 10% of sessions and replays
- **Error rate**: 100% (all errors are captured)

Adjust based on:
- Traffic volume
- Budget constraints
- Criticality of monitoring

### Data Privacy
- Sensitive data (passwords, tokens) is filtered by default
- PII can be scrubbed in Sentry settings
- Session recording can be disabled for EU users (GDPR)

### Cost Estimation (Sentry)
- Backend: ~$0-50/month (with 10% sampling)
- Frontend: ~$0-100/month (with replays)
- Always on free tier start, pay as you grow

---

## 🔍 Debugging Issues

### "Sentry is not initialized"
- Check `.env` file has `SENTRY_DSN` set
- Restart backend/frontend after changing `.env`

### "Errors not appearing in Sentry"
- Verify DSN is correct (copy-paste from Sentry dashboard)
- Check Sentry project is active (not archived)
- Wait 5-10 seconds (batch processing)

### "Frontend errors not captured"
- Check browser console (F12) for Sentry warnings
- Verify `VITE_SENTRY_DSN` is set in `ev-frontend/.env`
- Ensure npm packages installed: `npm list @sentry/react`

### "Performance metrics missing"
- Increase `SENTRY_TRACES_SAMPLE_RATE` to 1.0 for testing
- Set back to 0.1 for production

---

## 📚 Next Steps

1. **Deploy with Sentry enabled** → Catch real production errors
2. **Configure alert rules** → Get notified of critical issues
3. **Monitor for 24-48 hours** → Establish baseline performance
4. **Analyze error patterns** → Fix most common issues
5. **Scale monitoring** → Add more detailed tracking as needed

---

## 🆘 Support

- **Sentry Docs**: https://docs.sentry.io/
- **Alert Setup**: https://docs.sentry.io/product/alerts/alert-rules/
- **Sample Rates**: https://docs.sentry.io/platforms/node/configuration/sampling/
- **Discord Support**: Sentry community channels
