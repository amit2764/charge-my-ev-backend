import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { Button, Input, Card } from './components';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  const setUser = useStore(state => state.setUser);

  // Wait for reCAPTCHA script to be fully available
  useEffect(() => {
    const waitForRecaptcha = async () => {
      let attempts = 0;
      const maxAttempts = 50; // Wait up to 5 seconds
      
      console.log('Waiting for reCAPTCHA to load...');
      setDebugInfo('Initializing reCAPTCHA...');
      
      while (!window.grecaptcha && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (window.grecaptcha) {
        console.log('✓ reCAPTCHA loaded in', attempts * 100, 'ms');
        console.log('✓ grecaptcha object:', typeof window.grecaptcha);
        setRecaptchaReady(true);
        setDebugInfo('✓ reCAPTCHA ready');
      } else {
        console.error('✗ reCAPTCHA failed to load after', maxAttempts * 100, 'ms');
        setError('reCAPTCHA failed to load. Try: 1) Refresh page 2) Clear cookies 3) Disable ad blockers 4) Check internet');
        setDebugInfo('✗ reCAPTCHA load failed');
      }
    };
    
    waitForRecaptcha();
  }, []);

  // Cooldown timer for rate limiting
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const initializeRecaptcha = async () => {
    return new Promise((resolve, reject) => {
      try {
        console.log('Initializing RecaptchaVerifier...');
        
        if (!window.grecaptcha) {
          console.error('grecaptcha not available');
          reject(new Error('reCAPTCHA library not loaded'));
          return;
        }

        // Verify container exists
        const container = document.getElementById('recaptcha-container');
        if (!container) {
          console.error('reCAPTCHA container element not found');
          reject(new Error('reCAPTCHA container missing from DOM'));
          return;
        }
        
        // Clean up old verifier
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
            console.log('Cleared old verifier');
          } catch (e) {
            console.log('Could not clear old verifier:', e.message);
          }
          window.recaptchaVerifier = null;
        }

        console.log('Creating new RecaptchaVerifier instance...');
        
        // Create new verifier - use 'normal' for better visibility during debugging
        // Change back to 'invisible' in production if needed
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (token) => {
            console.log('✓ reCAPTCHA callback fired with token');
            resolve(verifier);
          },
          'expired-callback': () => {
            console.warn('⚠ reCAPTCHA expired');
            window.recaptchaVerifier = null;
            reject(new Error('reCAPTCHA expired. Please try again.'));
          },
          'error-callback': (error) => {
            console.error('✗ reCAPTCHA error callback:', error);
            window.recaptchaVerifier = null;
            reject(new Error('reCAPTCHA encountered an error'));
          }
        });
        
        window.recaptchaVerifier = verifier;
        console.log('RecaptchaVerifier created, waiting for verification...');
        
        // Set a timeout in case callback never fires
        const timeout = setTimeout(() => {
          console.log('reCAPTCHA callback timeout - resolving anyway');
          resolve(verifier);
        }, 3000);
        
      } catch (err) {
        console.error('Error creating RecaptchaVerifier:', err);
        reject(err);
      }
    });
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      // Check if in cooldown
      if (cooldownSeconds > 0) {
        setError(`Please wait ${cooldownSeconds} seconds before retrying.`);
        setLoading(false);
        return;
      }

      if (!recaptchaReady) {
        setError('reCAPTCHA is still loading. Please wait...');
        setLoading(false);
        return;
      }

      const cleanedPhone = phone.trim().replace(/\s+/g, '');
      if (!cleanedPhone) {
        setError('Please enter a valid phone number');
        setLoading(false);
        return;
      }
      
      const formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`;

      console.log('Step 1: Phone formatted:', formattedPhone);
      setDebugInfo('📱 Phone: ' + formattedPhone);
      
      console.log('Step 2: Initializing reCAPTCHA...');
      setDebugInfo('🔐 Initializing reCAPTCHA...');
      const verifier = await initializeRecaptcha();
      
      console.log('Step 3: reCAPTCHA ready, sending OTP...');
      setDebugInfo('📤 Sending OTP via Firebase...');
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      window.confirmationResult = confirmationResult;

      console.log('✓ OTP sent successfully');
      setDebugInfo('✓ OTP sent! Check your phone.');
      setPhone(formattedPhone);
      setStep('otp');
    } catch (err) {
      console.error('Firebase OTP error:', err);
      console.error('Error code:', err?.code);
      console.error('Error message:', err?.message);
      setDebugInfo('❌ Error: ' + err?.message);
      
      if (err?.code === 'auth/configuration-not-found') {
        setError('Firebase Auth not configured. Enable Phone sign-in in Firebase Console.');
      } else if (err?.code === 'auth/billing-not-enabled') {
        setError('Firebase requires Blaze plan for Phone Auth. Upgrade in Firebase Console → Billing.');
      } else if (err?.code === 'auth/too-many-requests') {
        setCooldownSeconds(60);
        setError('Too many requests. Please wait 60 seconds before trying again.');
        window.recaptchaVerifier = null;
      } else if (err?.code === 'auth/invalid-app-credential') {
        setError('reCAPTCHA verification failed. Tips: 1) Check browser console (F12) for errors 2) Disable VPN/Proxy 3) Disable ad blockers 4) Allow 3rd-party cookies');
        window.recaptchaVerifier = null;
      } else if (err?.message?.includes('reCAPTCHA')) {
        setError('reCAPTCHA error: ' + err.message + '. Try refreshing the page.');
        window.recaptchaVerifier = null;
      } else if (err?.code === 'auth/operation-not-supported-in-this-environment') {
        setError('Phone Auth not available. Check browser/VPN/network settings.');
      } else if (err?.message?.includes('Invalid phone number')) {
        setError('Invalid phone number. Use format: 9876543210 or +919876543210');
      } else if (err?.message?.includes('Cannot read') || err?.message?.includes('undefined')) {
        setError('reCAPTCHA container issue. Please refresh the page and try again.');
        window.recaptchaVerifier = null;
      } else {
        setError(err.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true); setError('');
    try {
      if (!window.confirmationResult) {
        setError('Please send OTP first.');
        return;
      }

      // Verify OTP with Firebase
      const result = await window.confirmationResult.confirm(otp);
      const user = result.user;

      console.log('Firebase user authenticated:', user.phoneNumber);

      // Store user in our app state
      setUser(user.phoneNumber);

      // You can also send user data to your backend here if needed
      // await api.post('/api/auth/store-user', { uid: user.uid, phone: user.phoneNumber });

    } catch (err) {
      console.error('Firebase verification error:', err);
      setError('Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-black text-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-white mb-2">Charge My EV</h1>
        <p className="text-gray-400">The future of personal charging.</p>
      </div>
      
      <Card className="w-full max-w-sm">
        {/* reCAPTCHA container for Firebase Phone Auth */}
        <div id="recaptcha-container"></div>
        
        {/* Debug info (helps diagnose reCAPTCHA issues) */}
        {debugInfo && (
          <div className="p-2 mb-3 text-xs text-gray-300 bg-gray-900/50 border border-gray-700 rounded text-center">
            {debugInfo}
          </div>
        )}
        
        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>}
        
        {step === 'phone' ? (
          <>
            <Input label="Phone Number" type="tel" placeholder="e.g. 9876543210" value={phone} onChange={e => setPhone(e.target.value)} disabled={cooldownSeconds > 0} />
            <Button 
              onClick={handleSendOtp} 
              disabled={loading || cooldownSeconds > 0}
            >
              {loading ? 'Sending...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send Code'}
            </Button>
          </>
        ) : (
          <>
            <Input label={`Enter OTP sent to ${phone}`} type="text" maxLength={6} placeholder="••••••" value={otp} onChange={e => setOtp(e.target.value)} />
            <Button onClick={handleVerifyOtp} disabled={loading}>{loading ? 'Verifying...' : 'Verify & Login'}</Button>
          </>
        )}
      </Card>
    </div>
  );
}