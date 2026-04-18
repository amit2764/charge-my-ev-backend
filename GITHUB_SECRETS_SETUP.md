# GitHub Actions Secrets Configuration

This guide helps you configure all required secrets for GitHub Actions CI/CD deployment.

## 📋 Step 1: Get Render Deploy Webhook

1. Go to https://dashboard.render.com/
2. Select your backend Web Service
3. Click on **Settings** tab
4. Scroll down to **Deploy Hook**
5. You'll see a URL like: `https://api.render.com/deploy/srv-xxxxxxxxxxxx`
6. Copy this URL

## 📋 Step 2: Get Vercel Credentials

### Vercel Token
1. Go to https://vercel.com/account/tokens
2. Click **Create Token**
3. Give it a name: `GitHub Actions Deploy`
4. Select Scope: **Full Account**
5. Expiration: 90 days (recommended)
6. Copy the token

### Vercel Project ID
1. Go to your Vercel project
2. Go to **Settings** tab
3. Look for **Project ID** under "General"
4. Copy this ID

### Vercel Organization ID  
1. Go to your Vercel account
2. Go to **Settings** → **Team** or **Account**
3. Look for **ID** or **Team ID**
4. Copy this ID

### Vercel Domain (optional)
- Your frontend domain after deployment (e.g., `your-project.vercel.app`)

## 🔐 Step 3: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** (top right)
3. In left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret**

Add these secrets one by one:

### Secret 1: RENDER_DEPLOY_WEBHOOK
- **Name**: `RENDER_DEPLOY_WEBHOOK`
- **Value**: `https://api.render.com/deploy/srv-xxxxxxxxxxxx`
- Click **Add secret**

### Secret 2: VERCEL_TOKEN
- **Name**: `VERCEL_TOKEN`
- **Value**: Your token from Step 2
- Click **Add secret**

### Secret 3: VERCEL_PROJECT_ID
- **Name**: `VERCEL_PROJECT_ID`
- **Value**: Your project ID from Step 2
- Click **Add secret**

### Secret 4: VERCEL_ORG_ID
- **Name**: `VERCEL_ORG_ID`
- **Value**: Your organization ID from Step 2
- Click **Add secret**

### Secret 5: VERCEL_DOMAIN
- **Name**: `VERCEL_DOMAIN`
- **Value**: `your-project.vercel.app`
- Click **Add secret**

## ✅ Verification

After adding all secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all 5 secrets listed:
   - ✅ RENDER_DEPLOY_WEBHOOK
   - ✅ VERCEL_TOKEN
   - ✅ VERCEL_PROJECT_ID
   - ✅ VERCEL_ORG_ID
   - ✅ VERCEL_DOMAIN

## 🧪 Test the CI/CD Pipeline

1. Make a test commit:
   ```bash
   git add -A
   git commit -m "test: CI/CD pipeline setup"
   git push origin main
   ```

2. Go to your GitHub repo
3. Click **Actions** tab
4. You should see workflows running:
   - "Tests & Linting" - runs first
   - "Deploy Backend to Render" - after linting passes
   - "Deploy Frontend to Vercel" - after linting passes

5. Monitor the deployments:
   - **Render**: https://dashboard.render.com/
   - **Vercel**: https://vercel.com/your-username

## 🆘 Troubleshooting

### Secrets are not found
- Verify spelling of secret names (case-sensitive)
- Make sure they're added to the correct repository (not organization)
- Workflows use `${{ secrets.SECRET_NAME }}` - must match exactly

### Deployment fails silently
- Check GitHub Actions logs for error messages
- Verify Render and Vercel accounts have access
- Check if tokens are expired

### Permission denied errors
- Verify Vercel token has "Full Account" scope
- Check if GitHub Actions is enabled in repo settings

## 📝 Environment Variables Recap

These are different from GitHub Secrets:

**Render (Backend Environment Variables):**
- `NODE_ENV=production`
- `SENTRY_DSN=xxx` (in Render dashboard)
- `FIREBASE_PROJECT_ID=ev-p2p` (in Render dashboard)
- etc. (set in Render dashboard, not GitHub)

**Vercel (Frontend Environment Variables):**
- `VITE_ENVIRONMENT=production` (in Vercel dashboard)
- `VITE_API_BASE_URL=xxx` (in Vercel dashboard)
- `VITE_SENTRY_DSN=xxx` (in Vercel dashboard)

**GitHub Secrets** (for deployment automation only):
- `RENDER_DEPLOY_WEBHOOK` (tells GitHub how to deploy to Render)
- `VERCEL_TOKEN` (authenticates Vercel deployment)
- `VERCEL_PROJECT_ID` (identifies which Vercel project to deploy)
- `VERCEL_ORG_ID` (identifies your Vercel organization)

---

**Next Step**: After setting up secrets, commit and push to `main` branch to trigger the first deployment!
