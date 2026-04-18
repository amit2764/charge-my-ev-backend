# Production Deployment Runbook

**Date**: April 18, 2026  
**Version**: 1.0  
**Audience**: DevOps / Deployment Engineer  

---

## 🎯 Deployment Overview

This runbook provides step-by-step instructions for deploying the EV charging platform to production using:
- **Backend**: Node.js on Render
- **Frontend**: React on Vercel  
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry

---

## ⏱️ Expected Timeline

- **Phase 1** (Account Setup): 5 minutes
- **Phase 2** (Backend Deploy): 15 minutes
- **Phase 3** (Frontend Deploy): 10 minutes
- **Phase 4** (GitHub Setup): 10 minutes
- **Phase 5** (Testing): 10 minutes
- **Total**: ~50 minutes

---

## 📋 Pre-Deployment Checklist

Before starting, verify:

- [ ] All code committed to GitHub main branch
- [ ] No sensitive credentials in Git history
- [ ] `.gitignore` includes: `key.json`, `.env`, `node_modules/`
- [ ] Backend starts locally: `npm start` (should show "Server running on port 3000")
- [ ] Frontend builds locally: `cd ev-frontend && npm run build` (should create `dist/` folder)
- [ ] Firebase credentials file (`key.json`) ready on local machine
- [ ] Sentry accounts created:
  - Backend Sentry project with DSN
  - Frontend Sentry project with DSN
- [ ] Internet connection stable
- [ ] Have 2 browser windows open (for Render and Vercel dashboards)

---

## Phase 1: Create Accounts

### 1.1 Create Render Account

**Time**: 2 minutes

```
1. Open: https://render.com/
2. Click: "Sign up"
3. Choose: "Continue with GitHub"
4. Authorize: GitHub access
5. Verify: Email (check inbox)
6. Result: You're logged into Render dashboard
```

**Verification**: Can see "New +" button in Render dashboard

### 1.2 Create Vercel Account

**Time**: 2 minutes

```
1. Open: https://vercel.com/
2. Click: "Sign up"
3. Choose: "Continue with GitHub"
4. Authorize: GitHub access
5. Verify: Email (check inbox)
6. Result: You're logged into Vercel dashboard
```

**Verification**: Can see "Add New" button in Vercel dashboard

---

## Phase 2: Deploy Backend to Render

### 2.1 Create Web Service

**Time**: 5 minutes

```
1. In Render dashboard, click: "New +"
2. Select: "Web Service"
3. Select: Your GitHub repository
4. If repo not listed:
   - Click: "Connect account"
   - Authorize Render
   - Select repository
5. Click: "Connect"
```

### 2.2 Configure Service

**Time**: 3 minutes

Fill in the form:

| Field | Value |
|-------|-------|
| Name | `ev-charging-backend-prod` |
| Environment | `Node` |
| Region | Choose closest (US-East or EU-Frankfurt) |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `node src/app.js` |
| Plan | `Standard` ($7/month) |

Leave other fields as default.

### 2.3 Add Environment Variables

**Time**: 5 minutes

1. In the form, find **Environment** section
2. Click **Add Environment Variable** for each:

```bash
NODE_ENV=production
PORT=3000
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
FIREBASE_PROJECT_ID=ev-p2p
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ev-p2p.iam.gserviceaccount.com
SENDGRID_API_KEY=SG.your-key
RAZORPAY_KEY_ID=rzp_live_your-key
RAZORPAY_KEY_SECRET=your-secret
ADMIN_API_KEY=your-strong-password
CORS_ORIGIN=https://your-project.vercel.app
```

**Important**: Replace placeholders with actual values

### 2.4 Add Private File (Firebase Key)

**Time**: 2 minutes

1. Find **Private files** section at bottom of form
2. Click **Add Private File**
3. Path: `/var/data/key.json`
4. Contents: Copy/paste entire contents of your local `key.json` file
5. Click **Save**

### 2.5 Deploy

**Time**: 3 minutes

1. Click **Create Web Service** button
2. Watch the build log:
   ```
   ✅ Cloning repository
   ✅ Running npm install
   ✅ Starting server on port 3000
   ✅ Connected to Firebase
   ✅ Sentry initialized
   ```
3. Wait for "Deploy live" message
4. Copy your service URL (e.g., `https://ev-charging-backend-prod.onrender.com`)

### 2.6 Verify Backend

**Time**: 2 minutes

Test health endpoint:

```bash
# Option 1: In terminal
curl https://ev-charging-backend-prod.onrender.com/api/health

# Option 2: In browser
Visit: https://ev-charging-backend-prod.onrender.com/api/health

# Expected response:
# {"status":"success","message":"Server is running normally"}
```

**Troubleshooting**: If fails, check Render logs for errors

---

## Phase 3: Deploy Frontend to Vercel

### 3.1 Import Project

**Time**: 3 minutes

```
1. In Vercel dashboard, click: "Add New"
2. Select: "Project"
3. Under "Import Git Repository", click: "GitHub"
4. Search for your repository
5. Click: "Import"
```

### 3.2 Configure Project

**Time**: 3 minutes

Form appears with auto-detected settings:

| Field | Should Show |
|-------|------------|
| Framework | React (auto-detected) |
| Root Directory | `ev-frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Click **Deploy**

### 3.3 Add Environment Variables

**Time**: 2 minutes

While deploy is building, go to **Project Settings** → **Environment Variables**

Add these for Production:

```bash
VITE_ENVIRONMENT=production
VITE_API_BASE_URL=https://ev-charging-backend-prod.onrender.com
VITE_SENTRY_DSN=https://your-frontend-sentry-key@sentry.io/project-id
```

**Note**: Use the backend URL from Phase 2.6

### 3.4 Verify Frontend

**Time**: 2 minutes

Wait for deployment to complete (~2 minutes)

1. Click deployment URL (shown in Vercel dashboard)
2. Should see **Login Screen** with:
   - Phone input field
   - Send OTP button
   - No console errors (F12 → Console tab)

**Troubleshooting**: If CORS error, check `CORS_ORIGIN` in Render backend

---

## Phase 4: Configure GitHub Actions

### 4.1 Get Render Webhook

**Time**: 2 minutes

```
1. In Render dashboard, click your service
2. Go to: Settings
3. Find: Deploy Hook
4. Copy the URL
5. Save it temporarily (need in next step)
```

### 4.2 Get Vercel Credentials

**Time**: 3 minutes

**Vercel Token:**
```
1. Visit: https://vercel.com/account/tokens
2. Click: "Create Token"
3. Name: "GitHub Actions Deploy"
4. Scope: "Full Account"
5. Expiration: 90 days
6. Copy the token
```

**Vercel Project ID:**
```
1. In Vercel project Settings
2. Find: "Project ID"
3. Copy it
```

**Vercel Organization ID:**
```
1. Visit: https://vercel.com/account/settings
2. Find: Organization ID or Team ID
3. Copy it
```

### 4.3 Add GitHub Secrets

**Time**: 3 minutes

1. Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets one at a time:

**Secret 1:**
- Name: `RENDER_DEPLOY_WEBHOOK`
- Value: URL from 4.1
- Click Add

**Secret 2:**
- Name: `VERCEL_TOKEN`
- Value: Token from 4.2
- Click Add

**Secret 3:**
- Name: `VERCEL_PROJECT_ID`
- Value: ID from 4.2
- Click Add

**Secret 4:**
- Name: `VERCEL_ORG_ID`
- Value: Organization ID from 4.2
- Click Add

**Secret 5:**
- Name: `VERCEL_DOMAIN`
- Value: Your Vercel domain (e.g., `your-project.vercel.app`)
- Click Add

---

## Phase 5: Test CI/CD Pipeline

### 5.1 Trigger Deployment

**Time**: 5 minutes

```bash
# In your local repo directory:
cd /path/to/your-repo

# Make a test commit
git add -A
git commit -m "test: CI/CD deployment verification"

# Push to main
git push origin main
```

### 5.2 Monitor GitHub Actions

**Time**: 5 minutes

```
1. Go to: GitHub repo → Actions tab
2. Find: Latest workflow run
3. Watch it execute:
   - Tests & Linting (should pass)
   - Backend Deploy (should succeed)
   - Frontend Deploy (should succeed)
4. Wait for green checkmarks ✅
```

### 5.3 Verify Deployments

**Time**: 3 minutes

**Backend:**
```bash
curl https://ev-charging-backend-prod.onrender.com/api/health
# Should return: {"status":"success",...}
```

**Frontend:**
```
1. Visit: https://your-project.vercel.app
2. Should see: Login Screen
3. Check console (F12): No errors
```

**Sentry:**
```
1. Visit: https://sentry.io/
2. Check both projects (backend + frontend)
3. Should show recent error events (or say "No events")
```

---

## ✅ Deployment Complete!

If all verifications passed:

- ✅ Backend running on Render
- ✅ Frontend deployed on Vercel
- ✅ GitHub Actions CI/CD working
- ✅ Both apps accessible via HTTPS
- ✅ Monitoring (Sentry) active

---

## 📊 Post-Deployment Tasks (Next 24 Hours)

### Hour 1: Immediate Verification

- [ ] Check Render logs for any warnings
- [ ] Check Vercel analytics for page loads
- [ ] Verify Sentry is receiving events
- [ ] Test API calls from frontend to backend
- [ ] Test Firebase authentication (send OTP)

### Hour 2-4: User Testing

- [ ] Create test user account
- [ ] Complete full login flow with OTP
- [ ] Test payment flow (use Razorpay test keys if still in test mode)
- [ ] Send test email through system
- [ ] Verify database writes to Firestore

### Hour 4-24: Monitoring

- [ ] Check error rates hourly
- [ ] Monitor database performance
- [ ] Review API response times
- [ ] Check CDN cache hit rate (Vercel analytics)
- [ ] Set up alerts in Sentry for critical errors

---

## 🆘 Emergency Rollback

If something goes seriously wrong:

### Rollback Backend (Render)

```
1. In Render dashboard
2. Click your service
3. Go to: Deployments
4. Find: Previous successful deployment
5. Click: ... (three dots)
6. Select: Redeploy
7. Wait for redeployment
```

### Rollback Frontend (Vercel)

```
1. In Vercel dashboard
2. Go to: Deployments
3. Find: Previous working deployment
4. Click it
5. Select: Promote to Production
6. Wait for redeployment
```

### Emergency Code Rollback (GitHub)

```bash
# Find the commit before the bad deployment:
git log --oneline

# Revert to previous commit:
git revert <commit-hash>

# Push (auto-triggers redeploy):
git push origin main
```

---

## 📞 Support Resources

| Issue | Resource |
|-------|----------|
| Build fails on Render | Check Render logs, then [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) |
| Build fails on Vercel | Check Vercel logs, then [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) |
| CORS errors | [Troubleshooting guide](DEPLOYMENT_QUICK_START.md#troubleshooting) |
| CI/CD pipeline errors | [GitHub setup guide](GITHUB_SECRETS_SETUP.md) |
| General questions | [Full deployment guide](DEPLOYMENT_GUIDE.md) |

---

## ✨ Congratulations!

You have successfully deployed the EV charging platform to production!

**Your App is Live:**
- 🎯 Backend: `https://ev-charging-backend-prod.onrender.com`
- 🎯 Frontend: `https://your-project.vercel.app`
- 📊 Monitoring: `https://sentry.io/`
- 📊 Database: Firebase Firestore Console

**Next Steps:**
1. Set up custom domains (optional)
2. Configure SMS provider for production
3. Switch Razorpay to live mode
4. Monitor for 24-48 hours
5. Onboard beta users
6. Scale infrastructure as needed

**Great job! 🚀**
