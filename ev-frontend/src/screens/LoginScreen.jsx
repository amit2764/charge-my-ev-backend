import React, { useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function LoginScreen({ onSendOtp, loading = false }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const [phone, setPhone] = useState('');

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  const heading = tx('auth.welcome', locale === 'hi' ? 'वापस स्वागत है' : 'Welcome back');
  const canSubmit = phone.length === 10 && !loading;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSendOtp?.(phone);
  }

  function handlePhoneChange(e) {
    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
  }

  return (
    <div style={{ minHeight: '100vh', background: c.page, color: c.text, padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '10vh auto 0', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: 20 }}>
        <h1 style={{ marginTop: 0 }}>{heading}</h1>
        <label style={{ display: 'block', marginBottom: 8, color: c.textMuted }}>{tx('auth.phone', 'Mobile Number')}</label>
        <div style={{ display: 'flex', minHeight: 52, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', background: c.page }}>
          <div style={{ width: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${c.border}`, background: c.surfaceRaised, color: c.text }}>+91</div>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            maxLength={10}
            onChange={handlePhoneChange}
            placeholder={tx('auth.phonePlaceholder', 'Enter your 10-digit number')}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: c.text, padding: '0 12px', fontSize: 16 }}
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{ marginTop: 16, width: '100%', minHeight: 50, border: 'none', borderRadius: 999, background: c.brandPrimary, color: c.page, fontWeight: 700, opacity: canSubmit ? 1 : 0.55 }}
        >
          {loading ? tx('auth.verifying', 'Verifying...') : tx('auth.sendOtp', 'Send OTP')}
        </button>
      </form>
    </div>
  );
}
