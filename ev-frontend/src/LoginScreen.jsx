import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { Button, Input, Card } from './components';

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

  /*
   * Steps:
   *  'quick'      – returning user: PIN / biometric
   *  'phone'      – enter phone number
   *  'otp'        – enter Firebase OTP
   *  'setup-pin'  – first login: create PIN
   *  'setup-bio'  – offer biometric enrolment after PIN setup
   */
  const isReturning = !!pinHash;
  const [step, setStep] = useState(isReturning ? 'quick' : 'phone');

  const [phone, setPhone] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState(localStorage.getItem('user') || '');
  const [otp, setOtp] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [recaptchaReady, setRecaptchaReady] = useState(false);

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
      setVerifiedPhone(phoneNumber);
      if (!pinHash) {
        setStep('setup-pin');
      } else {
        setUser(phoneNumber);
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
    else { setUser(verifiedPhone); }
  };

  const handleEnrollBiometric = async () => {
    setLoading(true); setError('');
    try {
      const credId = await registerBiometric(verifiedPhone);
      setBiometricCredentialId(credId);
      setInfo('Biometric enrolled ✓');
    } catch { setError('Biometric setup failed. You can enable it later in Profile.'); }
    finally { setLoading(false); setUser(verifiedPhone); }
  };

  const handleBiometricLogin = async () => {
    setLoading(true); setError('');
    try {
      await verifyBiometric(biometricCredentialId);
      setUser(localStorage.getItem('user'));
    } catch { setError('Biometric failed. Enter your PIN instead.'); }
    finally { setLoading(false); }
  };

  const handlePinLogin = async () => {
    setLoading(true); setError('');
    try {
      const ok = await verifyPin(pinInput);
      if (ok) { setUser(localStorage.getItem('user')); }
      else { setError('Wrong PIN. Try again or use phone OTP.'); setPinInput(''); }
    } finally { setLoading(false); }
  };

  const PinInput = ({ value, onChange, placeholder = '••••' }) => (
    <input
      type="password"
      inputMode="numeric"
      maxLength={6}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full p-3 bg-gray-900 border-2 border-gray-800 rounded-lg text-white text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
    />
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-black text-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-white mb-2">⚡ Charge My EV</h1>
        <p className="text-gray-400">The future of peer-to-peer charging.</p>
      </div>

      <Card className="w-full max-w-sm">
        <div id="recaptcha-container" />

        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>}
        {info && <div className="p-3 mb-4 text-sm text-green-400 bg-green-900/50 border border-green-800 rounded-lg">{info}</div>}

        {/* ── Returning user: quick login ── */}
        {step === 'quick' && (
          <div className="space-y-3">
            <p className="text-center text-gray-400 text-sm mb-4">
              Welcome back!<br />
              <span className="text-gray-500 text-xs">{localStorage.getItem('user')}</span>
            </p>

            {biometricCredentialId && isBiometricAvailable() && (
              <Button onClick={handleBiometricLogin} disabled={loading}>
                {loading ? 'Verifying…' : '🔑 Fingerprint / Face ID'}
              </Button>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-1">PIN</label>
              <PinInput value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <Button onClick={handlePinLogin} disabled={loading || pinInput.length < 4}>
              {loading ? 'Verifying…' : 'Unlock'}
            </Button>
            <button
              onClick={() => { setPinInput(''); setStep('phone'); }}
              className="w-full text-center text-xs text-cyan-500 hover:text-cyan-400 mt-2"
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
              <button onClick={() => setStep('quick')} className="w-full text-center text-xs text-cyan-500 hover:text-cyan-400 mt-3">
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
              className="w-full p-3 bg-gray-900 border-2 border-gray-800 rounded-lg text-white text-center text-2xl tracking-[0.5em] font-mono mb-4 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            />
            <Button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </Button>
            <button onClick={() => setStep('phone')} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 mt-3">
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
              <PinInput value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-1">Confirm PIN</label>
              <PinInput value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••" />
            </div>
            <Button onClick={handleSetupPin} disabled={loading || pinInput.length < 4}>
              {loading ? 'Saving…' : 'Set PIN & Continue'}
            </Button>
            <button onClick={() => setUser(verifiedPhone)} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 mt-1">
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
            <button onClick={() => setUser(verifiedPhone)} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 mt-1">
              Skip for now
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}