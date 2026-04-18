# 🚀 EV Charging Platform - Deployment Guide

**Date:** April 17, 2026  
**Status:** Ready for Production Deployment  
**Version:** 1.0.0

---

## 📋 TABLE OF CONTENTS

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Architecture](#deployment-architecture)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Database & Cache Setup](#database--cache-setup)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Troubleshooting](#troubleshooting)

---

## ✅ PRE-DEPLOYMENT CHECKLIST

- [ ] All environment variables configured in `.env`
- [ ] Firebase Firestore security rules deployed
- [ ] Database indexes created
- [ ] Backup strategy configured
- [ ] SSL/TLS certificates ready
- [ ] Domain names registered
- [ ] CDN configured (optional)
- [ ] Email templates tested
- [ ] Payment gateway in production mode
- [ ] Error tracking (Sentry) configured
- [ ] Monitoring alerts set up

---

## 🏗️ DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             FRONTEND TIER (CDN)                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • ev-frontend   (User/Host) - Vercel/Netlify      │  │
│  │  • ev-admin      (Admin)     - Vercel/Netlify      │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             API TIER (BACKEND)                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • Node.js/Express  - DigitalOcean/Heroku/AWS      │  │
│  │  • Port: 3000                                        │  │
│  │  • Process Manager: PM2                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                        ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           DATA & CACHE TIER                          │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • Firebase Firestore (Database)                    │  │
│  │  • Redis/Upstash (Cache & Queue)                    │  │
│  │  • Cloud Storage (Images/Files)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🖥️ BACKEND DEPLOYMENT

### Option 1: DigitalOcean App Platform (RECOMMENDED)

#### 1. Create DigitalOcean Account
- Visit https://www.digitalocean.com
- Create account and add payment method
- Create new project "EV-Charging"

#### 2. Set Up Droplet or Use App Platform
```bash
# Option A: Using Droplet (VPS)
- Image: Ubuntu 22.04 LTS
- Size: $12/month (2GB RAM, 2vCPU)
- Region: Closest to your users
- Enable backups

# Option B: Using App Platform (Recommended for Node.js)
- Framework: Node.js
- Repository: Connect your GitHub repo
- Build command: npm install && npm run build (if applicable)
- Run command: npm start
```

#### 3. Environment Variables
```bash
# In DigitalOcean App Platform:
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=ev-p2p
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ev-p2p.iam.gserviceaccount.com
REDIS_URL=your-upstash-redis-url
ADMIN_API_KEY=your-strong-password
SENDGRID_API_KEY=your-sendgrid-key
RAZORPAY_KEY_ID=your-production-key
RAZORPAY_KEY_SECRET=your-production-secret
# ... (copy all from .env)
```

#### 4. Deploy
```bash
# Push to GitHub
git add .
git commit -m "Production deployment v1.0"
git push origin main

# App Platform will auto-deploy on push
```

### Option 2: Heroku

```bash
# 1. Install Heroku CLI
curl https://cli.heroku.com/install.sh | sh

# 2. Login to Heroku
heroku login

# 3. Create app
heroku create ev-charging-api

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set FIREBASE_PROJECT_ID=ev-p2p
# ... (set all variables)

# 5. Deploy
git push heroku main

# 6. View logs
heroku logs --tail
```

### Option 3: AWS EC2

```bash
# 1. Launch EC2 instance
# - AMI: Ubuntu 22.04 LTS
# - Instance type: t3.medium
# - Storage: 30GB SSD
# - Security group: Allow HTTP/HTTPS/SSH

# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. Install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm git curl -y

# 4. Clone repository
git clone https://github.com/your-repo/ev-charging.git
cd ev-charging

# 5. Install PM2 (process manager)
sudo npm install -g pm2

# 6. Create .env file
nano .env
# (paste your production variables)

# 7. Install dependencies
npm install

# 8. Start with PM2
pm2 start src/server.js --name "ev-api" --instances max
pm2 startup
pm2 save

# 9. Configure reverse proxy (Nginx)
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/default
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name api.chargemyev.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🎨 FRONTEND DEPLOYMENT

### Option 1: Vercel (RECOMMENDED for React/Vite)

#### For ev-frontend (User/Host)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy frontend
cd ev-frontend
vercel --prod

# 4. Set environment variables
# In Vercel dashboard:
# - Add VITE_API_BASE_URL=https://api.chargemyev.com
# - Redeploy

# 5. Configure custom domain
# - In Vercel settings: Add domain chargemyev.com (or your domain)
```

#### For ev-admin (Admin Dashboard)
```bash
cd ev-admin
vercel --prod --name admin-dashboard
# Set domain: admin.chargemyev.com
```

### Option 2: Netlify

```bash
# 1. Connect GitHub repository
# Visit netlify.com → New site from Git

# 2. Configure build settings
Build command: npm run build
Publish directory: dist

# 3. Set environment variables
VITE_API_BASE_URL=https://api.chargemyev.com

# 4. Deploy
# Netlify will auto-deploy on push to main
```

### Option 3: AWS CloudFront + S3

```bash
# 1. Build frontends
cd ev-frontend && npm run build
cd ev-admin && npm run build

# 2. Create S3 buckets
aws s3 mb s3://chargemyev-frontend
aws s3 mb s3://chargemyev-admin

# 3. Upload builds
aws s3 sync ev-frontend/dist s3://chargemyev-frontend --delete
aws s3 sync ev-admin/dist s3://chargemyev-admin --delete

# 4. Configure CloudFront CDN
# - Create distribution pointing to S3 bucket
# - Set default root object to index.html
# - Configure error redirects to index.html (SPA)

# 5. Point domain to CloudFront
```

---

## 🗄️ DATABASE & CACHE SETUP

### Firebase Firestore

#### 1. Deploy Security Rules
```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Select project
firebase use ev-p2p

# 4. Deploy rules
firebase deploy --only firestore:rules

# 5. Deploy indexes
firebase deploy --only firestore:indexes
```

#### 2. Create Firestore Indexes

Required indexes:
```
Collection: requests
Fields: status (Ascending), createdAt (Descending)

Collection: bookings
Fields: userId (Ascending), status (Ascending)

Collection: responses
Fields: requestId (Ascending), price (Ascending)

Collection: trust_profiles
Fields: trustScore (Descending)
```

#### 3. Backup Strategy
```bash
# Enable automated backups in Firebase Console:
1. Firestore → Backups
2. Create backup schedule
3. Set retention to 30 days
4. Test restore process
```

### Redis/Upstash Setup

```bash
# 1. Create account at https://upstash.com
# 2. Create Redis database
# 3. Copy connection URL
# 4. Add to .env: REDIS_URL=rediss://...
# 5. Test connection:

redis-cli -u rediss://your-url PING
# Should return: PONG
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### 1. Health Check
```bash
curl https://api.chargemyev.com/api/health
# Should return: { "status": "ok" }
```

### 2. API Endpoints Test
```bash
# Test OTP endpoint
curl -X POST https://api.chargemyev.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# Test monitoring
curl https://api.chargemyev.com/api/admin/monitoring/metrics

# Test WebSocket
wscat -c wss://api.chargemyev.com/ws
```

### 3. Frontend Verification
- Visit https://chargemyev.com → Login screen loads
- Try OTP login flow
- Check browser console for no errors
- Verify API calls to correct backend URL

### 4. Admin Dashboard
- Visit https://admin.chargemyev.com
- Login with admin credentials
- Verify monitoring dashboard loads
- Check live sessions display

---

## 📊 MONITORING & ALERTING

### 1. Set Up Sentry (Error Tracking)

```bash
# 1. Create account at https://sentry.io
# 2. Create project for Node.js
# 3. Get DSN
# 4. Add to .env: SENTRY_DSN=https://...
# 5. Test error:
curl https://api.chargemyev.com/api/test/error
```

### 2. Set Up Monitoring Alerts

```bash
# Configure email alerts for:
- Error rate > 1%
- Response time > 500ms
- Memory usage > 80%
- Database connection failures
```

### 3. Uptime Monitoring

Use UptimeRobot (free):
```bash
1. Visit https://uptimerobot.com
2. Create monitor for https://api.chargemyev.com/api/health
3. Set check interval to 5 minutes
4. Add email alerts
```

---

## 🆘 TROUBLESHOOTING

### Backend Won't Start
```bash
# Check logs
pm2 logs ev-api

# Check port
lsof -i :3000

# Check environment variables
echo $NODE_ENV
echo $FIREBASE_PROJECT_ID
```

### Firebase Connection Error
```
Error: Unable to authenticate

Solution:
1. Verify key.json in root directory
2. Check FIREBASE_PROJECT_ID matches
3. Verify service account has Firestore access
4. Restart application
```

### Redis Connection Error
```
Error: REDIS_URL not configured

Solution:
1. Set REDIS_URL in environment
2. Test connection: redis-cli -u <REDIS_URL> PING
3. Verify TLS settings for Upstash
4. Check firewall rules
```

### Frontend API Connection Issues
```
CORS Error or 404 API responses

Solution:
1. Verify VITE_API_BASE_URL in env
2. Check ALLOWED_ORIGINS in backend .env
3. Verify backend is running
4. Check browser console for exact error
5. Clear cache and rebuild frontend
```

### SSL/TLS Certificate Issues
```bash
# Use Let's Encrypt (free):

# On Linux/Ubuntu:
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.chargemyev.com
sudo certbot renew --dry-run

# Certificates auto-renew daily
```

---

## 📈 POST-LAUNCH TASKS

### Week 1
- [ ] Monitor error rates and response times
- [ ] Verify all background jobs running
- [ ] Check email delivery status
- [ ] Monitor database performance
- [ ] Review user feedback

### Week 2
- [ ] Analyze booking conversion rate
- [ ] Check payment success rate
- [ ] Review trust score algorithm
- [ ] Optimize slow endpoints
- [ ] Plan marketing push

### Ongoing
- [ ] Daily: Check uptime and error logs
- [ ] Weekly: Review analytics and metrics
- [ ] Monthly: Database optimization and cleanup
- [ ] Quarterly: Security audit and penetration testing

---

## 🔒 SECURITY CHECKLIST FOR PRODUCTION

- [ ] HTTPS/SSL enabled on all endpoints
- [ ] Firestore rules restrict unauthorized access
- [ ] Admin API key is strong and unique
- [ ] Payment credentials in production mode
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Sensitive data encrypted at rest
- [ ] Regular backups tested
- [ ] Monitoring and alerting active
- [ ] DDoS protection enabled (Cloudflare)

---

## 📞 SUPPORT & RESOURCES

- **Firebase Console:** https://console.firebase.google.com
- **DigitalOcean Docs:** https://docs.digitalocean.com
- **Vercel Docs:** https://vercel.com/docs
- **Node.js Best Practices:** https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
- **WebSocket Deployment:** https://socket.io/docs/v4/deploying-to-multiple-machines/

---

**Last Updated:** April 17, 2026  
**Next Review:** May 1, 2026  
**Deployment Status:** Ready for Launch
