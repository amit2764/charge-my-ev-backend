# Vercel Frontend Deployment Guide

**Frontend Service**: React + Vite + Firebase Phone Auth + Sentry  
**Platform**: Vercel (Production)  

---

## 📋 Pre-Requisites

- [x] GitHub account with repository
- [x] Frontend code in `ev-frontend/` directory
- [x] `package.json` with `"build": "vite build"`
- [x] `vercel.json` configuration file (provided)
- [x] Sentry account and frontend DSN
- [x] Backend API URL from Render deployment

---

## 🚀 Step 1: Create Vercel Account

1. Visit https://vercel.com/
2. Click **Sign up**
3. Choose **Continue with GitHub**
4. Authorize Vercel to access your GitHub account
5. Verify email address

**You're ready to deploy!**

---

## 🚀 Step 2: Import GitHub Project

1. In Vercel dashboard, click **Add New** → **Project**
2. Under "Import Git Repository", click **GitHub**
3. Search for your repository
4. Click **Import**

---

## ⚙️ Step 3: Configure Project

You'll see a configuration screen:

### General Settings

| Field | Value |
|-------|-------|
| **Project Name** | `ev-charging-frontend-prod` |
| **Framework Preset** | React (auto-detected from Vite) |
| **Root Directory** | `ev-frontend` |
| **Node.js Version** | 22.x (LTS) |

### Build & Output Settings

| Field | Value |
|-------|-------|
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

Leave other fields as default (Vercel auto-detects most settings).

---

## 📌 Step 4: Set Environment Variables

Scroll down to **Environment Variables** and add:

### Environment Type: Production

| Name | Value |
|------|-------|
| `VITE_ENVIRONMENT` | `production` |
| `VITE_API_BASE_URL` | `https://your-backend-service.onrender.com` |
| `VITE_SENTRY_DSN` | `https://your-frontend-sentry-dsn@sentry.io/project-id` |

**Important**: Replace the values with your actual credentials:
- `VITE_API_BASE_URL`: From Render backend deployment (e.g., `https://ev-charging-backend-prod.onrender.com`)
- `VITE_SENTRY_DSN`: From your Sentry frontend project

### Environment Type: Preview (optional, for PR previews)

Same as above for testing pull request deployments.

---

## 🎯 Step 5: Deploy

1. Review all configurations
2. Click **Deploy**
3. Wait for build to complete (1-2 minutes)

**Watch the build log:**
- ✅ Dependencies installing
- ✅ Vite building React app
- ✅ Code optimization and minification
- ✅ Deployment to CDN

---

## 🔍 Step 6: Verify Deployment

Once deployment completes, you get a URL like:
```
https://ev-charging-frontend-prod.vercel.app
```

### Test the Frontend

1. Visit your Vercel URL in browser
2. You should see the **Login Screen**
3. Open browser console (F12 → Console)
4. You should see:
   - ✅ Firebase initialized
   - ✅ Sentry initialized
   - ✅ No errors

### Verify API Connection

In console, test API connection:
```javascript
fetch('https://your-backend-service.onrender.com/api/health')
  .then(r => r.json())
  .then(d => console.log(d))
```

Should respond:
```json
{"status":"success","message":"Server is running normally"}
```

---

## 🔄 Step 7: Enable Auto-Deployment from GitHub

**Auto-deployment is enabled by default!**

Now when you push to `main` branch:
1. GitHub Actions runs tests
2. Vercel auto-deploys on successful build
3. You can see deployment progress in Vercel dashboard

---

## 📊 Step 8: Monitor Your Frontend

### Vercel Dashboard

**Deployments Tab:**
- See deployment history
- View build logs
- Check deployment status
- Rollback to older version if needed

**Analytics Tab:**
- Page load times
- Web Vitals (CLS, FID, LCP)
- Traffic patterns
- Geographic distribution

### Sentry Dashboard

1. Visit https://sentry.io/
2. Select your frontend project
3. Monitor errors and performance
4. Set up alerts

---

## 🆘 Troubleshooting

### Build fails: "Cannot find module 'react'"

**Cause**: Dependencies not installed

**Fix**:
```bash
# In ev-frontend/
npm install

# Commit and push
git add package-lock.json
git commit -m "fix: install dependencies"
git push origin main
```

### Build fails: "VITE_API_BASE_URL is not defined"

**Cause**: Environment variable not set

**Fix**:
1. Go to Vercel Project Settings
2. Environment Variables
3. Add `VITE_API_BASE_URL` with backend URL
4. Redeploy

### Login page shows "Firebase not initialized"

**Cause**: `VITE_SENTRY_DSN` missing or Firebase config incorrect

**Fix**:
1. Check browser console for errors
2. Verify `VITE_SENTRY_DSN` is set
3. Check `ev-frontend/src/firebase.js` has correct config
4. Rebuild: `npm run build` locally first

### Deployment succeeds but app shows 404

**Cause**: Output directory incorrect

**Fix**:
1. Verify `dist/` exists: `ls -la ev-frontend/dist/`
2. Ensure build command is `npm run build`
3. Check `vercel.json` output directory is `dist`
4. Redeploy

### API calls fail with CORS error

**Cause**: Backend `CORS_ORIGIN` doesn't include your Vercel URL

**Fix**:
1. In Render dashboard, go to backend service
2. Environment → Find `CORS_ORIGIN`
3. Add your Vercel URL: `https://your-project.vercel.app`
4. Save and service auto-redeploys

### Performance is slow

**Cause**: Large bundle or slow API

**Fix**:
1. Check **Analytics** in Vercel
2. If LCP > 2.5s, optimize assets
3. If API calls slow, check backend logs
4. Enable code splitting in Vite config:
   ```javascript
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           vendor: ['react', 'react-dom', 'firebase']
         }
       }
     }
   }
   ```

---

## 🔐 Security Best Practices

- ✅ Never commit Firebase config as hardcoded (use environment variables)
- ✅ Keep Sentry DSN in environment variables
- ✅ Enable branch protection on GitHub
- ✅ Use private environment variables for sensitive data
- ✅ Regularly update dependencies: `npm audit`
- ✅ Monitor Sentry for security issues
- ✅ Enable rate limiting on backend

---

## 🎨 Custom Domain Setup

1. Go to **Project Settings** → **Domains**
2. Click **Add** button
3. Enter your domain: `chargemyev.com` or `app.chargemyev.com`

### DNS Configuration

Vercel provides DNS records to add to your registrar:

**For root domain (chargemyev.com):**
- Add `A` record: `76.76.19.163`
- Add `AAAA` record: `2606:4700:3031::6c4c:1343`

**For subdomain (app.chargemyev.com):**
- Add `CNAME` record pointing to: `cname.vercel-dns.com`

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Add the DNS records
3. Wait 15-30 minutes for propagation
4. SSL certificate auto-issued by Let's Encrypt

**Verify:**
```bash
curl https://chargemyev.com/
# Should return HTML content
```

---

## 🔄 Continuous Deployment

### Automatic Deployments

- ✅ Deployed on every push to `main`
- ✅ Preview deployments for pull requests
- ✅ Built with latest Node.js LTS

### Preview Deployments

1. Create a pull request on GitHub
2. Vercel auto-builds a preview URL
3. See it in GitHub checks: "Visit Preview"
4. Merge PR when ready → auto-deploys to production

### Manual Redeploy

If needed, manually redeploy:
1. Go to Vercel dashboard
2. Click **Deployments**
3. Find a past deployment
4. Click three dots → **Redeploy**

---

## 📈 Optimization Tips

### Code Splitting

Reduce initial bundle size:
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
          socket: ['socket.io-client']
        }
      }
    }
  }
}
```

### Image Optimization

Use Vercel's Image Optimization:
```jsx
import Image from 'next/image'
// But since using Vite, use:
<img src={url} alt="description" loading="lazy" />
```

### Enable Compression

Vercel automatically gzips assets, but verify:
```bash
curl -I https://your-project.vercel.app/
# Look for: content-encoding: gzip
```

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Status**: https://www.vercel-status.com/
- **Vite Documentation**: https://vitejs.dev/
- **React Documentation**: https://react.dev/
- **Firebase Docs**: https://firebase.google.com/docs

---

**Congratulations!** Your frontend is now deployed and auto-updating with every GitHub push!

**Next Steps:**
1. ✅ Set up backend (Render)
2. ✅ Set up frontend (Vercel)
3. ⏭️ Configure GitHub Actions for CI/CD
4. ⏭️ Set up monitoring and alerts
