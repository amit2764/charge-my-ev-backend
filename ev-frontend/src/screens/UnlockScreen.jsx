import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store';

const MAX_ATTEMPTS = 5;

export default function UnlockScreen({ user = {}, onUnlock, onUsePhone, biometricAvailable = false, onBiometric, loading = false }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const { verifyPin } = useStore();
  const isHindi = locale === 'hi';

  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [bioStatus, setBioStatus] = useState('idle');
  const [fadeOut, setFadeOut] = useState(false);
  const refs = useRef([]);

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  const triggerBiometric = useCallback(async () => {
    if (!biometricAvailable || !onBiometric) return;
    setBioStatus('prompting');
    try {
      const ok = await onBiometric();
      if (ok) {
        setFadeOut(true);
        setTimeout(() => onUnlock?.(), 400);
      } else {
        setBioStatus('failed');
      }
    } catch {
      setBioStatus('failed');
    }
  }, [biometricAvailable, onBiometric, onUnlock]);

  useEffect(() => {
    const id = setTimeout(() => triggerBiometric(), 0);
    return () => clearTimeout(id);
  }, [triggerBiometric]);

  useEffect(() => {
    const digits = pin.replace(/\D/g, '').slice(0, 4);
    if (digits !== pin) {
      setTimeout(() => setPin(digits), 0);
      return;
    }
    if (digits.length !== 4 || loading || attempts >= MAX_ATTEMPTS) return;
    setTimeout(async () => {
      const matched = await verifyPin(digits);
      if (matched) {
        setFadeOut(true);
        setTimeout(() => onUnlock?.(), 400);
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      setError(next >= MAX_ATTEMPTS
        ? tx('unlock.lockout', isHindi ? 'बहुत अधिक गलत प्रयास। फ़ोन नंबर से लॉगिन करें।' : 'Too many wrong attempts. Please use phone instead.')
        : tx('unlock.wrongPin', isHindi ? 'गलत PIN, फिर कोशिश करें।' : 'Wrong PIN, try again.'));
      refs.current[0]?.focus();
    }, 0);
  }, [pin, loading, attempts, verifyPin, onUnlock, t, isHindi]);

  const lockout = attempts >= MAX_ATTEMPTS;
  const firstName = (user?.displayName ?? '').split(' ')[0] || tx('unlock.user', 'User');

  return (
    <div style={{ minHeight: '100vh', background: c.page, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, opacity: fadeOut ? 0 : 1, transition: 'opacity 400ms ease' }}>
      <div style={{ width: '100%', maxWidth: 420, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: 20, textAlign: 'center' }}>
        <p style={{ color: c.textMuted }}>{tx('unlock.greeting', isHindi ? 'वापस आए,' : 'Welcome back,')} <strong style={{ color: c.text }}>{firstName}</strong></p>

        {!lockout && (
          <>
            <p style={{ color: c.textSoft }}>{tx('unlock.enterPin', isHindi ? 'PIN दर्ज करें' : 'Enter your PIN')}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                return (
                  <div key={i} style={{ width: 54, height: 62, borderRadius: 12, border: `2px solid ${filled ? c.brandPrimary : c.border}`, background: filled ? c.brandPrimarySoft : 'transparent', position: 'relative' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.brandPrimary, opacity: filled ? 1 : 0, position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                    <input
                      ref={(el) => (refs.current[i] = el)}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={filled ? '•' : ''}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, '').slice(-1);
                        const arr = pin.padEnd(4, ' ').split('');
                        arr[i] = d || ' ';
                        setPin(arr.join('').replace(/\s+$/g, ''));
                        if (d && i < 3) refs.current[i + 1]?.focus();
                      }}
                      disabled={loading || fadeOut}
                      style={{ position: 'absolute', inset: 0, opacity: 0, border: 'none', background: 'transparent' }}
                    />
                  </div>
                );
              })}
            </div>

            {biometricAvailable && (
              <button type="button" onClick={triggerBiometric} disabled={bioStatus === 'prompting' || loading || fadeOut} style={{ marginTop: 14, borderRadius: 12, border: `1px solid ${c.brandPrimary}`, background: c.brandPrimarySoft, color: c.brandPrimary, padding: '10px 14px' }}>
                {bioStatus === 'prompting'
                  ? tx('unlock.scanning', isHindi ? 'स्कैन हो रहा है…' : 'Scanning…')
                  : tx('unlock.useBiometric', isHindi ? 'बायोमेट्रिक से अनलॉक करें' : 'Use Biometric')}
              </button>
            )}
          </>
        )}

        {error && <p style={{ color: c.error, marginTop: 14 }}>{error}</p>}

        <button
          type="button"
          onClick={() => onUsePhone?.()}
          disabled={loading || fadeOut}
          style={{ marginTop: lockout ? 24 : 18, border: 'none', background: 'transparent', color: lockout ? c.brandPrimary : c.textSoft, textDecoration: 'underline' }}
        >
          {tx('unlock.usePhone', isHindi ? 'फ़ोन नंबर से लॉगिन करें' : 'Use phone number instead')}
        </button>
      </div>
    </div>
  );
}
