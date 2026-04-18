# 🚀 QUICK START: PRODUCTION DEPLOYMENT

**Fastest path to get live in 24 hours**

---

## STEP 1: CHOOSE YOUR STACK (5 minutes)

### Recommended Stack
- **Backend:** DigitalOcean App Platform OR Heroku
- **Frontend:** Vercel
- **Database:** Firebase Firestore (already configured)
- **Cache:** Upstash Redis
- **Email:** SendGrid (already configured)
- **Payments:** Razorpay

---

## STEP 2: PREPARE CREDENTIALS (15 minutes)

### Gather These Keys
```
1. Firebase Firestore credentials (you have these ✓)
2. Razorpay PRODUCTION keys (switch from test)
3. SendGrid API key (you have this ✓)
4. Redis/Upstash URL (create new account)
5. Strong admin password for /api/admin/login
```

### Get Upstash Redis (FREE TIER)
```bash
1. Visit https://upstash.com/
2. Sign up (free account)
3. Create Redis database
4. Copy URL like: rediss://default:password@host:port
5. Add to .env as REDIS_URL=
```

---

## STEP 3: UPDATE PRODUCTION VARIABLES (10 minutes)

### Edit `.env` file
```bash
# Already configured:
FIREBASE_PROJECT_ID=ev-p2p ✓
SENDGRID_API_KEY ✓
RAZORPAY_KEY_ID (CHANGE TO PRODUCTION)
RAZORPAY_KEY_SECRET (CHANGE TO PRODUCTION)

# NEW - Add these:
NODE_ENV=production
REDIS_URL=rediss://... (from Upstash)
ADMIN_API_KEY=your-strong-password-change-me
ALERT_EMAIL_TO=your-email@company.com
```

### Frontend `.env.production` (already created)
```bash
VITE_API_BASE_URL=https://api.chargemyev.com
```

---

## STEP 4: DEPLOY BACKEND (30 minutes)

### Option A: Heroku (FASTEST)
```bash
# 1. Create account: https://www.heroku.com
# 2. Install Heroku CLI: brew install heroku
# 3. Login
heroku login

# 4. Create app
heroku create ev-charging-api

# 5. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set FIREBASE_PROJECT_ID=ev-p2p
heroku config:set REDIS_URL=rediss://...
heroku config:set ADMIN_API_KEY=your-password
# ... (all other variables)

# 6. Deploy
git push heroku main

# 7. Verify
heroku logs --tail
heroku open
# Should see app running
```

### Option B: DigitalOcean (CHEAPER)
```bash
# 1. Create account: https://www.digitalocean.com
# 2. Create new App Platform app
# 3. Connect GitHub repository
# 4. Set build command: npm install
# 5. Set run command: npm start
# 6. Add all environment variables in dashboard
# 7. Deploy and verify
```

---

## STEP 5: DEPLOY FRONTENDS (30 minutes)

### Deploy User/Host Frontend (Vercel)
```bash
# 1. Sign up at https://vercel.com
# 2. Import GitHub project: ev-frontend
# 3. Set Framework: Vite
# 4. Add environment variable:
#    VITE_API_BASE_URL=https://api.chargemyev.com
# 5. Deploy
# 6. Configure domain: app.chargemyev.com
```

### Deploy Admin Dashboard (Vercel)
```bash
# 1. Import project: ev-admin
# 2. Set Framework: Vite
# 3. Add environment variable:
#    VITE_API_BASE_URL=https://api.chargemyev.com
# 4. Deploy
# 5. Configure domain: admin.chargemyev.com
```

---

## STEP 6: VERIFY DEPLOYMENT (15 minutes)

### Backend Health Check
```bash
curl https://api.chargemyev.com/api/health
# Should return: { "status": "ok" }
```

### Test OTP Flow
```bash
curl -X POST https://api.chargemyev.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
# Should return OTP
```

### Test Admin Login
```bash
curl -X POST https://api.chargemyev.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@chargemyev.com", "password": "your-admin-password"}'
# Should return token
```

### Visit Frontends
- https://app.chargemyev.com - User/Host app
- https://admin.chargemyev.com - Admin dashboard

---

## STEP 7: CONFIGURE DOMAINS (15 minutes)

### Buy Domain
- GoDaddy, Namecheap, or similar
- Example: chargemyev.com

### Configure DNS Records
```
api.chargemyev.com     → CNAME → your-heroku-app.herokuapp.com
app.chargemyev.com     → CNAME → your-vercel-deployment.vercel.app
admin.chargemyev.com   → CNAME → your-vercel-deployment.vercel.app
```

---

## STEP 8: ENABLE SSL/TLS (5 minutes)

### Heroku (AUTO)
- SSL is automatic on *.herokuapp.com

### Vercel (AUTO)
- SSL is automatic on vercel.app domains
- Custom domains get free SSL via Let's Encrypt

### Custom Domain
- All services auto-provision SSL

---

## STEP 9: VERIFY MONITORING (10 minutes)

### Check Backend Logs
```bash
# Heroku
heroku logs --tail

# DigitalOcean
# In dashboard: Monitor tab
```

### Check Errors
```bash
curl https://api.chargemyev.com/api/admin/monitoring/metrics
```

### Monitor Sentry (Optional)
- Create account: https://sentry.io
- Add SENTRY_DSN to backend .env
- See errors in real-time

---

## STEP 10: TEST END-TO-END (15 minutes)

### User Flow Test
1. Open https://app.chargemyev.com
2. Enter phone number (e.g., +919876543210)
3. Check browser console or Heroku logs for OTP
4. Enter OTP to verify
5. Switch to Host mode
6. Create charging request (User side)
7. Host responds with price
8. User confirms booking
9. Start charging with OTP
10. Stop charging with OTP
11. Complete payment
12. Submit rating

### Admin Flow Test
1. Open https://admin.chargemyev.com
2. Email: admin@chargemyev.com
3. Password: (your ADMIN_API_KEY)
4. View live sessions
5. Check monitoring metrics

---

## TROUBLESHOOTING

### Backend Won't Start
```bash
# Check logs
heroku logs --tail

# Common issues:
- Missing environment variable
- Redis connection failed
- Firebase credentials invalid

# Fix:
heroku config # See all vars
heroku config:set VARIABLE=value
```

### Frontend Shows 404
```bash
# Check VITE_API_BASE_URL
# Should match your backend domain

# Rebuild and redeploy
npm run build
git push origin main # Vercel auto-deploys
```

### API Connection Error
```bash
# Check CORS in backend .env
ALLOWED_ORIGINS should include frontend domains

# Check if backend is running
curl https://api.chargemyev.com/api/health
```

---

## 🎉 YOU'RE LIVE!

**Summary:**
- ✅ Backend deployed on Heroku/DigitalOcean
- ✅ Frontends deployed on Vercel
- ✅ Database: Firebase (configured)
- ✅ Cache: Redis (Upstash)
- ✅ Emails: SendGrid (configured)
- ✅ Payments: Razorpay (production mode)
- ✅ Monitoring: Active
- ✅ SSL/TLS: Enabled

**Next Steps:**
1. Monitor for 24 hours
2. Check error rates
3. Verify payment processing
4. Collect user feedback
5. Plan marketing launch

**Support:**
- Backend issues: `heroku logs --tail`
- Frontend issues: Browser console → DevTools
- Database issues: Firebase Console
- Payment issues: Razorpay Dashboard

---

**Deployed on:** _______________  
**Domain:** _______________  
**Team Lead:** _______________  

Time to go LIVE: **~3 hours** ⚡
