Production Firebase Setup
=========================

This document explains how to configure Firebase credentials for production and how to provide them to the app via environment variables.

1) Create a Service Account
- In the Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.
- You will get a JSON file (serviceAccount.json). Keep it secure.

2) Option A — Use raw private key (not recommended for CI)
- Copy the `private_key` field from the JSON and set `FIREBASE_PRIVATE_KEY` in your `.env`.
- Make sure to replace real newlines with `\n` if putting directly in `.env`.

3) Option B — Use base64-encoded private key (recommended)
- Extract the `private_key` field and base64-encode it. Examples:

  macOS / Linux (requires `jq`):

  ```bash
  jq -r '.private_key' serviceAccount.json | base64 -w0 > private_key.b64
  # Then set FIREBASE_PRIVATE_KEY_B64 to the contents of private_key.b64
  ```

  PowerShell (Windows):

  ```powershell
  $json = Get-Content serviceAccount.json | ConvertFrom-Json
  $b = [Text.Encoding]::UTF8.GetBytes($json.private_key)
  [Convert]::ToBase64String($b) | Out-File private_key.b64 -Encoding ascii
  ```

- Set the env var `FIREBASE_PRIVATE_KEY_B64` to the base64 string.

4) Required environment variables (example `.env` entries)

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=service-account@your-firebase-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY_B64=BASE64_ENCODED_PRIVATE_KEY

5) Notes
- The app supports either `FIREBASE_PRIVATE_KEY` (raw, with `\n` escapes) or `FIREBASE_PRIVATE_KEY_B64` (base64) to avoid newline problems.
- If credentials are not provided or invalid, the app will run in `mockMode` and DB calls will be logged but not persisted.
- For CI/CD, store these secrets in your pipeline secret store (GitHub Actions secrets, environment variables in deployment platform).

6) Post-setup verification
- Start the server with the environment vars set and check logs for `Firebase initialized successfully`.
- Run `node simulate-full-system.js` with `SIMULATION_CONFIG.USE_DIRECT_CALLS=false` to exercise HTTP endpoints against the real Firestore (note: other integrations like SMS must be configured for a full real-world test).
