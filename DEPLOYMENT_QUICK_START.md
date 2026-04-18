# Quick Deployment Checklist - April 2026

**Status**: Live on Railway + Vercel  
**Last Updated**: April 18, 2026

---

## Current Production URLs

- Backend health: https://charge-my-ev-backend-production.up.railway.app/health
- Frontend: https://ev-frontend-chi.vercel.app

---

## 1) GitHub Actions Secrets (Required)

Go to repository settings:
https://github.com/amit2764/charge-my-ev-backend/settings/secrets/actions

Add these backend secrets:
- `RAILWAY_TOKEN`
- `RAILWAY_PROJECT_ID` = `81ce96dd-3c6d-4805-90f8-cae777319e71`
- `RAILWAY_SERVICE_ID` = `17fd80d1-334e-40b5-96dd-598fb2e42fe6`

Add these frontend secrets:
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID` = `prj_Alkuu4FfGwxfI6WJrbNqC2bKDHJ9`
- `VERCEL_ORG_ID` = `team_Rk1m8qUZybNaIdrK2P84bhrW`
- `VERCEL_DOMAIN` = `ev-frontend-chi.vercel.app` (for notification output only)

---

## 2) CI/CD Workflows in Repo

- Backend deploy workflow: `.github/workflows/deploy-backend.yml`
  - Deploys to Railway using Railway CLI
  - Trigger: push to `main` with backend file changes
- Frontend deploy workflow: `.github/workflows/deploy-frontend.yml`
  - Deploys to Vercel
  - Trigger: push to `main` with `ev-frontend` changes
- Test workflow: `.github/workflows/tests-lint.yml`
  - Runs lint/build checks on push and PR

---

## 3) Railway Runtime Variables (Backend)

Ensure these are configured on Railway service:

- `NODE_ENV=production`
- `FIREBASE_PROJECT_ID=ev-p2p`
- `FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ev-p2p.iam.gserviceaccount.com`
- `FIREBASE_PRIVATE_KEY_B64=<base64 of key.json content>`
- `ADMIN_API_KEY=<random strong secret>`

Optional but recommended:
- `REDIS_URL=<production redis url>`
- `CORS_ORIGIN=https://ev-frontend-chi.vercel.app`
- `SENTRY_DSN=<backend sentry dsn>`

Notes:
- Firebase now loads from env vars; no `key.json` file is needed in deployment.
- Health endpoint for deployed backend is `/health`.

---

## 4) Vercel Variables (Frontend)

Ensure production variables include:

- `VITE_API_BASE_URL=https://charge-my-ev-backend-production.up.railway.app`
- `VITE_ENVIRONMENT=production`
- `VITE_SENTRY_DSN=<frontend sentry dsn>` (optional)

Notes:
- `ev-frontend/vercel.json` is configured to install with `npm install --legacy-peer-deps`.

---

## 5) Validate End-to-End

Use these commands:

```powershell
Invoke-RestMethod "https://charge-my-ev-backend-production.up.railway.app/health"
Invoke-WebRequest "https://ev-frontend-chi.vercel.app" -UseBasicParsing
```

Expected:
- Backend returns `status = ok`
- Frontend returns HTTP 200

---

## 6) Trigger CI/CD Verification

1. Make a small backend commit and push to `main`.
2. Confirm backend GitHub action runs and deploys to Railway.
3. Make a small frontend commit in `ev-frontend` and push to `main`.
4. Confirm frontend GitHub action runs and deploys to Vercel.

Actions page:
https://github.com/amit2764/charge-my-ev-backend/actions

---

## 7) Fast Troubleshooting

- Backend workflow skipped:
  - Missing `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, or `RAILWAY_SERVICE_ID` secret.
- Frontend workflow skipped:
  - Missing `VERCEL_TOKEN`.
- Railway build error mentioning `key.json`:
  - Confirm Docker image does not copy `key.json`.
- Health check fails on `/api/health`:
  - Use `/health` for this deployed service entrypoint.
- PowerShell web request prompt appears:
  - Add `-UseBasicParsing` to avoid interactive security prompt.

---

## 8) Recommended Next Hardening

- Add `REDIS_URL` in Railway to enable cache/locks.
- Add Sentry DSNs for backend and frontend.
- Enable branch protection on `main` with required checks.
- Add custom domains and set `CORS_ORIGIN` to final frontend domain.
