# CI/CD & Deployment Infrastructure - Complete Setup

**Last Updated**: April 18, 2026  
**Status**: 🚀 Ready for Production  

---

## Overview

Your EV charging platform now has complete production-ready deployment infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Repository (main)                      │
│                                                                   │
│  ├─ src/                   (Backend code)                        │
│  ├─ ev-frontend/           (Frontend code)                       │
│  └─ .github/workflows/     (CI/CD automation)                    │
│      ├─ deploy-backend.yml                                       │
│      ├─ deploy-frontend.yml                                      │
│      └─ tests-lint.yml                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ (Push to main)
                              │
        ┌─────────────────────┴────────────────────┐
        │                                           │
        ↓                                           ↓
   GitHub Actions                           GitHub Actions
   Tests & Linting                          Deploys if tests pass
        │                                           │
        └─────────────────────┬────────────────────┘
                              │
        ┌─────────────────────┼────────────────────┐
        ↓                     ↓                     ↓
   Render                 Vercel              Sentry
   (Backend)             (Frontend)          (Monitoring)
   Node.js API           React App           Error Tracking
   Port 3000             Build: Vite         Performance
   Firestore             CDN Edge            Real-time
```

---

## 📦 What's Included

### 1. GitHub Actions Workflows ✅
- **Location**: `.github/workflows/`
- **Files Created**:
  - `deploy-backend.yml` - Deploys to Render on push
  - `deploy-frontend.yml` - Deploys to Vercel on push
  - `tests-lint.yml` - Runs tests and linting

### 2. Backend Configuration ✅
- **Location**: `render.json`
- **Contents**: Render deployment settings for Node.js server
- **Start Command**: `node src/app.js`
- **Environment**: Production with auto-scaling

### 3. Frontend Configuration ✅
- **Location**: `ev-frontend/vercel.json`
- **Contents**: Vercel deployment settings for Vite build
- **Build**: `npm run build`
- **Output**: `dist/` directory

### 4. Deployment Guides ✅
- `DEPLOYMENT_QUICK_START.md` - Fast checklist for deployment
- `RENDER_DEPLOYMENT.md` - Detailed Render backend setup
- `VERCEL_DEPLOYMENT.md` - Detailed Vercel frontend setup
- `GITHUB_SECRETS_SETUP.md` - GitHub Actions secrets configuration

---

## 🚀 Quick Start (Day 1 Deployment)

### Phase 1: Create Accounts (5 minutes)

```bash
# 1. Render Backend
Visit: https://render.com/
Sign up with GitHub
→ Get dashboard access

# 2. Vercel Frontend
Visit: https://vercel.com/
Sign up with GitHub
→ Get dashboard access
```

### Phase 2: Deploy Backend to Render (15 minutes)

```bash
# In Render dashboard:
# 1. New → Web Service
# 2. Select your GitHub repo
# 3. Configure:
#    - Build: npm install
#    - Start: node src/app.js
# 4. Add environment variables (see RENDER_DEPLOYMENT.md)
# 5. Deploy

# Verify:
curl https://your-backend.onrender.com/api/health
```

### Phase 3: Deploy Frontend to Vercel (10 minutes)

```bash
# In Vercel dashboard:
# 1. Add Project → Import from GitHub
# 2. Select your repo
# 3. Root: ev-frontend
# 4. Build: npm run build
# 5. Output: dist
# 6. Add environment variables (see VERCEL_DEPLOYMENT.md)
# 7. Deploy

# Verify: Visit https://your-frontend.vercel.app in browser
```

### Phase 4: Configure GitHub Secrets (10 minutes)

```bash
# In GitHub repo → Settings → Secrets → Actions:
# Add these secrets (see GITHUB_SECRETS_SETUP.md):
# 1. RENDER_DEPLOY_WEBHOOK
# 2. VERCEL_TOKEN
# 3. VERCEL_PROJECT_ID
# 4. VERCEL_ORG_ID
# 5. VERCEL_DOMAIN
```

### Phase 5: Test CI/CD Pipeline (5 minutes)

```bash
# Push a test commit to main
git add -A
git commit -m "test: CI/CD deployment"
git push origin main

# Watch GitHub Actions:
# 1. Tests & Linting runs
# 2. Backend auto-deploys to Render
# 3. Frontend auto-deploys to Vercel
```

**Total Time**: ~45 minutes from start to full production deployment! ⚡

---

## 📊 Deployment Matrix

| Component | Platform | Build | Start | Monitor | Region |
|-----------|----------|-------|-------|---------|--------|
| **Backend** | Render | `npm install` | `node src/app.js` | Render Dashboard | US-East/EU-Frankfurt |
| **Frontend** | Vercel | `npm run build` | Auto (static) | Vercel Dashboard | CDN Edge |
| **Errors** | Sentry | - | - | https://sentry.io/ | Cloud |
| **Database** | Firebase | - | - | Firebase Console | Cloud |
| **CI/CD** | GitHub Actions | Tests | Deploy | GitHub Actions | Cloud |

---

## 🔄 How It Works: Push to Production

**Step 1**: Developer pushes to `main` branch
```bash
git push origin main
```

**Step 2**: GitHub Actions triggers automatically

**Step 3**: Tests & Linting runs
```bash
✅ Install dependencies
✅ Lint code
✅ Build frontend (npm run build)
✅ Verify critical files exist
✅ Security checks
```

**Step 4**: If tests pass, two deployments happen in parallel

**Backend Deployment:**
```bash
Render webhook triggered
↓
Render clones your repo
↓
Runs: npm install
↓
Starts: node src/app.js
↓
Available at: https://your-backend.onrender.com
```

**Frontend Deployment:**
```bash
Vercel downloads your code
↓
Runs: npm run build (in ev-frontend/)
↓
Generates: dist/ with optimized React app
↓
Deploys to CDN edge locations
↓
Available at: https://your-frontend.vercel.app
```

**Step 5**: Users can immediately access new version

---

## 📋 Environment Variables Checklists

### Backend (Render)
```bash
☐ NODE_ENV=production
☐ PORT=3000
☐ SENTRY_DSN=https://xxx@sentry.io/123
☐ FIREBASE_PROJECT_ID=ev-p2p
☐ FIREBASE_CLIENT_EMAIL=xxx
☐ SENDGRID_API_KEY=SG.xxx
☐ RAZORPAY_KEY_ID=rzp_live_xxx
☐ RAZORPAY_KEY_SECRET=xxx
☐ CORS_ORIGIN=https://your-frontend.vercel.app
```

### Frontend (Vercel)
```bash
☐ VITE_ENVIRONMENT=production
☐ VITE_API_BASE_URL=https://your-backend.onrender.com
☐ VITE_SENTRY_DSN=https://xxx@sentry.io/234
```

### GitHub Actions Secrets
```bash
☐ RENDER_DEPLOY_WEBHOOK
☐ VERCEL_TOKEN
☐ VERCEL_PROJECT_ID
☐ VERCEL_ORG_ID
☐ VERCEL_DOMAIN
```

---

## 📈 Monitoring After Deployment

### First Hour
- [ ] Backend responding at health endpoint
- [ ] Frontend loads without console errors
- [ ] Sentry receiving errors from both
- [ ] Database queries working normally
- [ ] No spike in error rates

### First Day
- [ ] Review Sentry error dashboard
- [ ] Check Render service logs
- [ ] Monitor Vercel analytics
- [ ] Test user registration flow
- [ ] Test payment flow with test credentials
- [ ] Verify OTP sending via Firebase Phone Auth

### Ongoing
- [ ] Daily: Check Sentry errors
- [ ] Weekly: Review performance metrics
- [ ] Monthly: Audit dependencies for updates
- [ ] Quarterly: Review and update security settings

---

## 🆘 Common Deployment Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| Backend won't start | Missing env var | Check Render logs, add variable |
| Frontend shows 404 | Build path wrong | Ensure build command = `npm run build`, output = `dist` |
| CORS errors | Frontend URL not in CORS list | Update `CORS_ORIGIN` in Render, redeploy |
| Sentry not capturing | DSN incorrect or project archived | Verify DSN and project is active in Sentry |
| Deploy fails | Secrets not found | GitHub secrets must match workflow variable names |
| API unreachable | Wrong URL in frontend | Update `VITE_API_BASE_URL` to actual backend URL |

---

## 🔐 Security Checklist

Before going live:

- [ ] Firebase credentials stored only in Render environment files
- [ ] API keys rotated and strong
- [ ] GitHub repository private
- [ ] Branch protection enabled on `main`
- [ ] Secrets not committed to Git
- [ ] Rate limiting enabled on backend
- [ ] HTTPS enforced (auto-managed by Render/Vercel)
- [ ] Firestore security rules configured
- [ ] Admin API key strong (30+ chars)
- [ ] Razorpay in LIVE mode (not test keys)
- [ ] No console.log of sensitive data
- [ ] Sentry properly configured

---

## 📞 Support & Documentation

### Quick Links
- GitHub Actions: https://docs.github.com/en/actions
- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Firebase: https://firebase.google.com/docs
- Sentry: https://docs.sentry.io/

### Detailed Guides
- Backend deployment: [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
- Frontend deployment: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)
- GitHub setup: [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)
- Quick checklist: [DEPLOYMENT_QUICK_START.md](DEPLOYMENT_QUICK_START.md)

---

## ✅ Completed Setup Checklist

- [x] Created `.github/workflows/` directory structure
- [x] Created `deploy-backend.yml` workflow
- [x] Created `deploy-frontend.yml` workflow
- [x] Created `tests-lint.yml` workflow
- [x] Created `render.json` backend configuration
- [x] Created `ev-frontend/vercel.json` frontend configuration
- [x] Created comprehensive deployment guides
- [x] Created GitHub secrets setup guide
- [x] Created Render deployment guide
- [x] Created Vercel deployment guide
- [x] Created quick start checklist

---

## 🎯 Next Steps

1. **Today**: Review all documentation
2. **Tomorrow**: 
   - Create Render account → Deploy backend
   - Create Vercel account → Deploy frontend
3. **After Deployment**:
   - Configure GitHub secrets
   - Push test commit to trigger CI/CD
   - Monitor first deployments
4. **Optional**:
   - Set up custom domains
   - Configure alerts in Sentry
   - Enable analytics

---

**You're now production-ready! 🚀**

All infrastructure is in place for reliable, automated deployments.
Every push to `main` will automatically deploy to production.
