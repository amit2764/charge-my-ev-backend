Project TODOs
=============

Launch Tasks
------------
- [ ] Create landing page & signup forms (in-progress)
- [ ] Prepare outreach messages and assets
- [ ] Post to communities and DM outreach
- [ ] Run referral push and track metrics
- [ ] Engage, iterate and report results

Integration Checklist
---------------------
- [x] Configure Firestore (prod) & Auth
- [x] Integrate SMS provider (Fast2SMS) for OTP
- [x] Complete Payment Gateway (Razorpay) webhooks & payouts
- [x] Integrate Email provider (SendGrid/Mailgun)
- [x] Deploy hosting & CI/CD (Render backend + Vercel frontend + GitHub Actions)
- [x] Add Monitoring & Error Reporting (Sentry/Prometheus)
- [ ] Setup Logging & Retention (Cloud Logging/ELK)
- [ ] Background jobs & queue (Redis + Bull / SQS)
- [ ] Maps & Geolocation (Google Maps / OSM)
- [ ] KYC / Identity verification for hosts
- [x] Cloud Storage for media (Charger images, Profile pics)
- [ ] Rate limiting & WAF (Cloudflare)
- [x] Payment dispute handling & reconciliation
- [ ] Legal templates: Terms, Privacy, Host agreement


Notes
-----
- The in-memory todo list is tracked by the assistant; this file mirrors the current items so you can edit/view them in the workspace.
- Tell me which integration to start and I'll begin implementing it step-by-step.
