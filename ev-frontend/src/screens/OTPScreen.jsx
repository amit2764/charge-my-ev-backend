import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function OTPScreen({ phone = '', verifying = false, onBack, onVerifyOtp, onResendOtp, onChangeNumber }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(45);
  const refs = useRef([]);

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const formattedPhone = useMemo(() => {
    const digits = String(phone).replace(/\D/g, '').slice(-10);
    if (!digits) return '+91 XXXXX XXXXX';
    return `+91 XXXXX ${digits.slice(-5)}`;
  }, [phone]);

  function handleChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = otp.padEnd(6, ' ').split('');
    arr[index] = digit || ' ';
    const next = arr.join('').replace(/\s+$/g, '');
    setOtp(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
    if (next.length === 6 && !verifying) onVerifyOtp?.(next);
  }

  function onResend() {
    if (secondsLeft > 0) return;
    setSecondsLeft(45);
    setOtp('');
    refs.current[0]?.focus();
    onResendOtp?.();
  }

  return (
    <div style={{ minHeight: '100vh', background: c.page, color: c.text, padding: 20 }}>
      <button type="button" onClick={() => onBack?.()} style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${c.border}`, background: c.surface, color: c.text }}>←</button>
      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>{tx('auth.enterOtp', locale === 'hi' ? 'OTP दर्ज करें' : 'Enter OTP')}</h1>
        <p style={{ color: c.textMuted }}>{tx('auth.otpSent', 'OTP sent to')} {formattedPhone}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={otp[i] || ''}
              onChange={(e) => handleChange(i, e.target.value)}
              style={{ width: 44, height: 54, borderRadius: 10, border: `1.5px solid ${verifying ? c.brandPrimary : c.border}`, background: c.surface, color: c.text, textAlign: 'center', fontSize: 22 }}
            />
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          {secondsLeft > 0 ? (
            <span style={{ color: c.textMuted }}>{tx('auth.resendIn', 'Resend in')} 0:{String(secondsLeft).padStart(2, '0')}</span>
          ) : (
            <button type="button" onClick={onResend} style={{ border: 'none', background: 'transparent', color: c.brandPrimary, fontWeight: 600 }}>
              {tx('auth.resend', 'Resend OTP')}
            </button>
          )}
        </div>
        <button type="button" onClick={() => onChangeNumber?.()} style={{ marginTop: 8, border: 'none', background: 'transparent', color: c.textSoft, textDecoration: 'underline' }}>
          {tx('auth.changeNumber', 'Change number')}
        </button>
      </div>
    </div>
  );
}
