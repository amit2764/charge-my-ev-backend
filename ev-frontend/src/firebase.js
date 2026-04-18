// Firebase configuration for client-side authentication
// IMPORTANT: Replace the apiKey, messagingSenderId, and appId with values from Firebase Console
// Go to Firebase Console > Project Settings > General > Your apps > Web app
//
// SETUP CHECKLIST:
// ✓ Authentication → Sign-in method → Enable PHONE provider
// ✓ Authentication → Settings → Authorized domains → Add "localhost"
// ✓ Billing → Upgrade to BLAZE plan (pay-as-you-go)
// ✓ index.html → reCAPTCHA script loaded: https://www.google.com/recaptcha/api.js
// ✓ Browser → Allow 3rd-party cookies (reCAPTCHA uses them)
// ✓ Browser → No VPN/Proxy (reCAPTCHA blocks them)
// ✓ Browser → No ad blockers blocking reCAPTCHA
//
// IMPORTANT NOTES:
// - Phone Auth uses Firebase's implicit reCAPTCHA. Do NOT enable reCAPTCHA v3 separately.
// - Firebase enforces rate limiting: max 5 OTPs per phone number per hour
// - If you exceed limits, wait ~60 seconds before retrying
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBaWC5TJ2YEF1QRw9xF4hxGWZNu3LTVQOY",
  authDomain: "ev-p2p.firebaseapp.com",
  projectId: "ev-p2p",
  storageBucket: "ev-p2p.firebasestorage.app",
  messagingSenderId: "329477379562",
  appId: "1:329477379562:web:e020ec50b93facea988e93",
  measurementId: "G-47KMK4C8J0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

export default app;