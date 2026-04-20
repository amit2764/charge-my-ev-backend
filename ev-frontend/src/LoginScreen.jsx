import { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from './firebase';

function resolveUserUid() {
  // Prefer a live Firebase Auth session (uid) over any cached value
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  return sanitizeUserId(localStorage.getItem('authUser') || localStorage.getItem('user'));
}
import { useStore } from './store';
import { Button, Input, Card } from './components';

function sanitizeUserId(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  const lowered = normalized.toLowerCase();
  if (!normalized || lowered === 'null' || lowered === 'undefined') return '';
  return normalized;
}

function PinInput({ value, onChange, placeholder = '••••', autoComplete = 'off' }) {
  const inputRef = useRef(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    if (!shouldRestoreFocusRef.current || !inputRef.current) return;
    if (document.activeElement !== inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      const cursorPosition = inputRef.current.value.length;
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }
    shouldRestoreFocusRef.current = false;
  }, [value]);

  const handleChange = (event) => {
    shouldRestoreFocusRef.current = document.activeElement === event.target;
    onChange(event);
  };

  return (
    <input
      ref={inputRef}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      autoComplete={autoComplete}
      maxLength={6}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      className="w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none transition-all focus:border-cyan-400/45 focus:ring-2 focus:ring-cyan-500/35"
    />
  );
}

// ─── Biometric helpers ───────────────────────────────────────────────────────

function isBiometricAvailable() {
  return (
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.create === 'function'
  );
}

async function registerBiometric(userId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Charge My EV', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userId,
        displayName: 'EV User'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      },
      timeout: 60000
    }
  });
  const idBytes = new Uint8Array(credential.rawId);
  return btoa(String.fromCharCode(...idBytes));
}

async function verifyBiometric(credentialIdB64) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const rawId = Uint8Array.from(atob(credentialIdB64), c => c.charCodeAt(0));
  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ id: rawId, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000
    }
  });
  return true;
}

export default function LoginScreen() {
  const { setUser, pinHash, biometricCredentialId, verifyPin, setPin, setBiometricCredentialId } = useStore();
  const storedUser = sanitizeUserId(localStorage.getItem('authUser') || localStorage.getItem('user'));
  const canQuickLogin = !!pinHash && !!storedUser;

  /*
   * Steps:
   *  'quick'      – returning user: PIN / biometric
   *  'phone'      – enter phone number
   *  'otp'        – enter Firebase OTP
   *  'setup-pin'  – first login: create PIN
   *  'setup-bio'  – offer biometric enrolment after PIN setup
   */
  const isReturning = canQuickLogin;
  const [step, setStep] = useState(canQuickLogin ? 'quick' : 'phone');

  const [verifiedUserId, setVerifiedUserId] = useState('');
  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState(storedUser);
  const [otp, setOtp] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  const completeLoginWithVerifiedPhone = () => {
    // Prefer Firebase UID; fall back to any stored identity
    const safeUid = sanitizeUserId(verifiedUserId) || resolveUserUid();
    if (!safeUid) {
      setError('Session data is invalid. Please log in again with OTP.');
      setStep('phone');
      return false;
    }
    setUser(safeUid);
    return true;
  };

  // ── reCAPTCHA loader
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.grecaptcha) { clearInterval(interval); setRecaptchaReady(true); }
      else if (attempts > 60) { clearInterval(interval); setError('reCAPTCHA failed to load. Refresh and disable ad blockers.'); }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ── Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(p => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const initRecaptcha = () =>
    new Promise((resolve, reject) => {
      try {
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (clearErr) { void clearErr; }
          window.recaptchaVerifier = null;
        }
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => resolve(verifier),
          'expired-callback': () => { window.recaptchaVerifier = null; reject(new Error('reCAPTCHA expired.')); }
        });
        window.recaptchaVerifier = verifier;
        setTimeout(() => resolve(verifier), 3000);
      } catch (e) { reject(e); }
    });

  const handleSendOtp = async () => {
    setLoading(true); setError('');
    try {
      if (cooldown > 0) { setError(`Wait ${cooldown}s.`); return; }
      if (!recaptchaReady) { setError('reCAPTCHA loading, please wait…'); return; }
      const clean = phone.trim().replace(/\s+/g, '');
      if (!clean) { setError('Enter a valid phone number.'); return; }
      const formatted = clean.startsWith('+') ? clean : `+91${clean}`;
      const verifier = await initRecaptcha();
      const result = await signInWithPhoneNumber(auth, formatted, verifier);
      window.confirmationResult = result;
      setVerifiedPhone(formatted);
      setStep('otp');
    } catch (err) {
      window.recaptchaVerifier = null;
      if (err?.code === 'auth/too-many-requests') { setCooldown(60); setError('Too many attempts. Wait 60 s.'); }
      else if (err?.code === 'auth/invalid-app-credential') { setError('reCAPTCHA failed. Disable ad blockers / VPN and retry.'); }
      else setError(err?.message || 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setLoading(true); setError('');
    try {
      if (!window.confirmationResult) { setError('Send OTP first.'); return; }
      const result = await window.confirmationResult.confirm(otp);
      const phoneNumber = result.user.phoneNumber;
      const firebaseUid = result.user.uid;
      setVerifiedPhone(phoneNumber);
      setVerifiedUserId(firebaseUid);
      if (!pinHash) {
        setStep('setup-pin');
      } else {
        const safeUid = sanitizeUserId(firebaseUid);
        if (!safeUid) {
          setError('Invalid session returned from login. Please retry.');
          return;
        }
        setUser(safeUid);
      }
    } catch { setError('Invalid OTP. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleSetupPin = async () => {
    setError('');
    if (pinInput.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    if (pinInput !== pinConfirm) { setError('PINs do not match.'); return; }
    setLoading(true);
    await setPin(pinInput);
    setLoading(false);
    if (isBiometricAvailable()) { setStep('setup-bio'); }
    else { completeLoginWithVerifiedPhone(); }
  };

  const handleEnrollBiometric = async () => {
    setLoading(true); setError('');
    try {
      const credId = await registerBiometric(verifiedPhone);
      setBiometricCredentialId(credId);
      setInfo('Biometric enrolled ✓');
    } catch { setError('Biometric setup failed. You can enable it later in Profile.'); }
    finally {
      setLoading(false);
      completeLoginWithVerifiedPhone();
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true); setError('');
    try {
      await verifyBiometric(biometricCredentialId);
      const safeUid = resolveUserUid();
      if (!safeUid) {
        setError('Quick login session not linked. Use phone OTP once.');
        setStep('phone');
        return;
      }
      setUser(safeUid);
    } catch { setError('Biometric failed. Enter your PIN instead.'); }
    finally { setLoading(false); }
  };

  const handlePinLogin = async () => {
    setLoading(true); setError('');
    try {
      const ok = await verifyPin(pinInput);
      if (ok) {
        const safeUid = resolveUserUid();
        if (!safeUid) {
          setError('Quick login session not linked. Use phone OTP once.');
          setStep('phone');
          return;
        }
        setUser(safeUid);
      }
      else { setError('Wrong PIN. Try again or use phone OTP.'); setPinInput(''); }
    } finally { setLoading(false); }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_42%),linear-gradient(180deg,#020617,#0f172a)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] text-white sm:justify-center md:min-h-screen">
      <div className="ambient-orb left-[6%] top-[8%] h-28 w-28 bg-blue-500/25" />
      <div className="ambient-orb right-[12%] top-[18%] h-24 w-24 bg-emerald-500/20" />
      <div className="mb-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Welcome back</p>
        <h1 className="mb-2 mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">⚡ Charge My EV</h1>
        <p className="text-gray-400">The future of peer-to-peer charging.</p>
      </div>

      <Card className="w-full max-w-sm overflow-hidden border border-white/10 sm:mb-0">
        <div id="recaptcha-container" />

        {error && <div className="mb-4 rounded-[16px] border border-red-500/30 bg-red-900/30 p-3 text-sm text-red-300">{error}</div>}
        {info && <div className="mb-4 rounded-[16px] border border-emerald-500/30 bg-emerald-900/20 p-3 text-sm text-emerald-300">{info}</div>}

        {/* ── Returning user: quick login ── */}
        {step === 'quick' && (
          <div className="space-y-3">
            <p className="text-center text-gray-400 text-sm mb-4">
              Welcome back!<br />
              <span className="text-gray-500 text-xs">{storedUser || 'Saved account'}</span>
            </p>

            {biometricCredentialId && isBiometricAvailable() && (
              <Button onClick={handleBiometricLogin} disabled={loading}>
                {loading ? 'Verifying…' : '🔑 Fingerprint / Face ID'}
              </Button>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-1">PIN</label>
              <PinInput autoComplete="current-password" value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <Button onClick={handlePinLogin} disabled={loading || pinInput.length < 4}>
              {loading ? 'Verifying…' : 'Unlock'}
            </Button>
            <button
              onClick={() => { setPinInput(''); setStep('phone'); }}
              className="mt-2 w-full text-center text-xs text-cyan-400 hover:text-cyan-300"
            >
              Login with phone OTP instead
            </button>
          </div>
        )}

        {/* ── Phone number entry ── */}
        {step === 'phone' && (
          <>
            <Input
              label="Mobile Number"
              type="tel"
              placeholder="9876543210 or +919876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={cooldown > 0}
            />
            <Button onClick={handleSendOtp} disabled={loading || cooldown > 0}>
              {loading ? 'Sending…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send OTP'}
            </Button>
            {isReturning && (
              <button onClick={() => setStep('quick')} className="mt-3 w-full text-center text-xs text-cyan-400 hover:text-cyan-300">
                ← Back to quick login
              </button>
            )}
          </>
        )}

        {/* ── OTP entry ── */}
        {step === 'otp' && (
          <>
            <p className="text-sm text-gray-400 mb-4 text-center">OTP sent to <span className="text-white font-semibold">{verifiedPhone}</span></p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mb-4 w-full rounded-[18px] border border-white/10 bg-slate-950/70 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none focus:border-cyan-400/45 focus:ring-2 focus:ring-cyan-500/35"
            />
            <Button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </Button>
            <button onClick={() => setStep('phone')} className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-300">
              ← Change number
            </button>
          </>
        )}

        {/* ── Create PIN ── */}
        {step === 'setup-pin' && (
          <div className="space-y-3">
            <div className="text-center mb-2">
              <p className="font-bold text-white">Create your PIN</p>
              <p className="text-xs text-gray-500 mt-1">Replaces OTP for future logins on this device</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-1">New PIN (4–6 digits)</label>
              <PinInput autoComplete="new-password" value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-1">Confirm PIN</label>
              <PinInput autoComplete="new-password" value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••" />
            </div>
            <Button onClick={handleSetupPin} disabled={loading || pinInput.length < 4}>
              {loading ? 'Saving…' : 'Set PIN & Continue'}
            </Button>
            <button onClick={completeLoginWithVerifiedPhone} className="mt-1 w-full text-center text-xs text-gray-500 hover:text-gray-300">
              Skip, use OTP every time
            </button>
          </div>
        )}

        {/* ── Enrol biometric ── */}
        {step === 'setup-bio' && (
          <div className="space-y-3 text-center">
            <p className="text-4xl mb-2">🔑</p>
            <p className="font-bold text-white">Enable biometric login?</p>
            <p className="text-xs text-gray-500">Use fingerprint or Face ID instead of your PIN next time</p>
            <Button onClick={handleEnrollBiometric} disabled={loading}>
              {loading ? 'Setting up…' : 'Enable Fingerprint / Face ID'}
            </Button>
            <button onClick={completeLoginWithVerifiedPhone} className="mt-1 w-full text-center text-xs text-gray-500 hover:text-gray-300">
              Skip for now
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}