# Render Backend Deployment Guide

**Backend Service**: Node.js + Express + Firebase + Sentry  
**Platform**: Render.com (Production)  

---

## 📋 Pre-Requisites

- [x] GitHub account with repository created
- [x] Backend code in `src/` directory  
- [x] `package.json` with `"start": "node src/app.js"`
- [x] `render.json` configuration file (provided)
- [x] Firebase credentials (`key.json`)
- [x] Sentry account created and DSN obtained

---

## 🚀 Step 1: Create Render Account

1. Visit https://render.com/
2. Click **Sign up**
3. Choose **Sign up with GitHub**
4. Authorize Render to access your GitHub account
5. Verify email address

**You're now ready to deploy!**

---

## 🚀 Step 2: Connect GitHub Repository

1. In Render dashboard, click **New +** button
2. Select **Web Service**
3. Select your GitHub repository
4. If not listed, click "Connect account" and authorize
5. Choose the repository with your backend code
6. Click **Connect**

---

## ⚙️ Step 3: Configure Service

Fill in the following details:

| Field | Value |
|-------|-------|
| **Name** | `ev-charging-backend-prod` |
| **Environment** | `Node` |
| **Region** | Select based on user location (US-East for US, EU-Frankfurt for Europe) |
| **Branch** | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `node src/app.js` |
| **Plan** | Start with **Standard** ($7/month) - auto-scales up if needed |

---

## 📌 Step 4: Set Environment Variables

In the Render service configuration, go to **Environment** section and add these variables:

### Core Configuration
```
NODE_ENV = production
PORT = 3000
```

### Firebase Configuration
```
FIREBASE_PROJECT_ID = ev-p2p
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@ev-p2p.iam.gserviceaccount.com
```
(Replace with your actual Firebase credentials)

### Sentry Error Tracking
```
SENTRY_DSN = https://your-sentry-key@sentry.io/your-project-id
SENTRY_ENVIRONMENT = production
SENTRY_TRACES_SAMPLE_RATE = 0.1
SENTRY_PROFILES_SAMPLE_RATE = 0.1
```

### Email Service (SendGrid)
```
SENDGRID_API_KEY = SG.your_api_key
SENDGRID_FROM_EMAIL = noreply@chargemyev.com
```

### Payment Processing (Razorpay)
```
RAZORPAY_KEY_ID = rzp_live_your_key_id
RAZORPAY_KEY_SECRET = your_key_secret
```
⚠️ **Important**: Use LIVE keys in production, not test keys

### CORS and Security
```
CORS_ORIGIN = https://your-frontend-domain.vercel.app
ADMIN_API_KEY = generate-a-strong-random-string
```

### Redis (if using BullMQ for job queues)
```
REDIS_URL = redis://user:password@host:port
```
(Use Upstash Redis for free tier: https://upstash.com/)

---

## 📁 Step 5: Upload Firebase Credentials

Firebase requires authentication. Add the key file to Render:

1. In Render service dashboard, go to **Environment**
2. Scroll down to **Private files** section
3. Click **Add Private File**
4. Path: `/var/data/key.json`
5. Paste contents of your local `key.json` file
6. Click **Save**

---

## 🎯 Step 6: Create and Deploy

1. Review all configurations
2. Click **Create Web Service**
3. Wait for build to complete (2-3 minutes)

**Watch the build log:**
- ✅ Dependencies installing
- ✅ Firebase configuration loading
- ✅ Service starting on port 3000

---

## 🔍 Step 7: Verify Deployment

Once deployment completes, you get a service URL like:
```
https://ev-charging-backend-prod.onrender.com
```

### Test the Health Endpoint

```bash
curl https://ev-charging-backend-prod.onrender.com/api/health
```

Expected response:
```json
{
  "status": "success",
  "message": "Server is running normally"
}
```

### Check Logs

1. In Render dashboard, click your service
2. Go to **Logs** tab
3. You should see:
   ```
   Server running on port 3000
   Connected to Firebase
   Sentry initialized
   ```

---

## 🔄 Step 8: Enable Auto-Deployment

1. Go to **Settings**
2. Under **Deploy Hooks**, you'll see your deployment webhook URL
3. Copy this URL
4. This is your `RENDER_DEPLOY_WEBHOOK` - add to GitHub Secrets

**Now GitHub Actions will auto-deploy when you push to `main`**

---

## 📊 Step 9: Monitor Your Service

### Daily Monitoring

In Render dashboard for your service:

**Metrics Tab:**
- CPU usage (should be < 50%)
- Memory usage (should be < 80%)
- Request count
- Error rate

**Logs Tab:**
- Check for errors every hour
- Look for warnings
- Monitor Sentry integration

### Sentry Dashboard

1. Visit https://sentry.io/
2. Select your project
3. Check for new errors
4. Set up alerts:
   - Alert when error rate > 1%
   - Alert for critical errors
   - Send to Slack/Email

---

## 🆘 Troubleshooting

### Build fails with "Cannot find module"

**Cause**: Dependency not installed

**Fix**:
```bash
# Locally
npm install

# Then push to GitHub
git add package-lock.json
git commit -m "fix: update dependencies"
git push origin main

# Render will rebuild
```

### Service crashes immediately after deploy

**Cause**: Usually missing environment variable or Firebase key

**Fix**:
1. Check Logs tab for error message
2. Add missing environment variable
3. Verify Firebase key path is `/var/data/key.json`
4. Click **Manual Deploy** to retry

### Database connection timeout

**Cause**: Firebase Firestore not responding

**Fix**:
1. Verify `FIREBASE_PROJECT_ID` is correct
2. Check Firebase console for any issues
3. Verify IP allowlist (if applicable)
4. Contact Firebase support if persistent

### High memory usage

**Cause**: Memory leak or too many connections

**Fix**:
1. Check Logs for suspicious activity
2. Upgrade plan from Standard to Pro
3. Add connection pooling if using database connections
4. Restart service (Render will auto-restart if memory exceeds limit)

---

## 🔐 Security Best Practices

- ✅ Never commit `key.json` to GitHub (it's in `.gitignore`)
- ✅ Always use private environment variables for secrets
- ✅ Enable "Auto-deploy on push" only for trusted branches
- ✅ Rotate API keys periodically
- ✅ Use strong `ADMIN_API_KEY` password
- ✅ Monitor Sentry for security issues
- ✅ Check logs regularly for unauthorized access attempts

---

## 📈 Scaling

As your service grows:

### Stage 1: Standard Plan ($7/month)
- Good for development and small production
- Up to 10GB RAM
- Auto-scales horizontally

### Stage 2: Pro Plan ($25/month)  
- For medium production load
- 20GB RAM per instance
- Better CPU performance
- Priority support

### Stage 3: Custom Plan
- Enterprise features
- Dedicated instances
- Custom support

**Upgrade in Settings → Plan**

---

## Custom Domain Setup

1. Go to **Settings** → **Custom Domains**
2. Add domain: `api.chargemyev.com`
3. Add CNAME record to your DNS registrar:
   - Host: `api`
   - Points to: `ev-charging-backend-prod.onrender.com`
4. Wait 15-30 minutes for DNS propagation
5. SSL certificate auto-issued

**Verify:**
```bash
curl https://api.chargemyev.com/api/health
```

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com/
- **Firebase Support**: https://firebase.google.com/support
- **Sentry Documentation**: https://docs.sentry.io/
- **Express.js Docs**: https://expressjs.com/

---

**Next**: Set up frontend deployment on Vercel
