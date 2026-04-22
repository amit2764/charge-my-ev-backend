import React, { createRef, useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store';

export default function PINSetupScreen({ onComplete, loading = false }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const { setPin: savePin } = useStore();
  const isHindi = locale === 'hi';

  const [step, setStep] = useState('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [enterRefs] = useState(() => Array.from({ length: 4 }, () => createRef()));
  const [confirmRefs] = useState(() => Array.from({ length: 4 }, () => createRef()));

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  useEffect(() => {
    if (step === 'enter' && pin.length === 4) {
      const id = setTimeout(() => setStep('confirm'), 250);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [pin, step]);

  useEffect(() => {
    if (step !== 'confirm' || confirmPin.length !== 4 || loading) return;
    if (confirmPin === pin) {
      setTimeout(async () => {
        await savePin(pin);
        onComplete?.(pin);
      }, 0);
      return;
    }
    setTimeout(() => {
      setError(isHindi ? 'PINs मेल नहीं खाते, फिर कोशिश करें' : "PINs don't match, try again");
    }, 0);
    const id = setTimeout(() => {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setError('');
      enterRefs[0]?.current?.focus();
    }, 650);
    return () => clearTimeout(id);
  }, [confirmPin, pin, step, loading, savePin, onComplete, isHindi, enterRefs]);

  function renderBoxes(current, setCurrent, refs) {
    return (
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
        {[0, 1, 2, 3].map((i) => {
          const filled = i < current.length;
          return (
            <div key={i} style={{ width: 56, height: 64, borderRadius: 14, border: `2px solid ${filled ? c.brandPrimary : c.border}`, background: filled ? c.brandPrimarySoft : 'transparent', position: 'relative' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.brandPrimary, opacity: filled ? 1 : 0, position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
              <input
                ref={refs[i]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={filled ? '•' : ''}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(-1);
                  const arr = current.padEnd(4, ' ').split('');
                  arr[i] = d || ' ';
                  setCurrent(arr.join('').replace(/\s+$/g, ''));
                  if (d && i < 3) refs[i + 1]?.current?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Backspace') return;
                  const arr = current.padEnd(4, ' ').split('');
                  if (!current[i] && i > 0) refs[i - 1]?.current?.focus();
                  arr[i] = ' ';
                  setCurrent(arr.join('').replace(/\s+$/g, ''));
                }}
                disabled={loading}
                style={{ position: 'absolute', inset: 0, opacity: 0, border: 'none', background: 'transparent' }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  const heading = step === 'confirm'
    ? tx('pin.confirmHeading', isHindi ? 'PIN की पुष्टि करें' : 'Confirm your PIN')
    : tx('pin.setHeading', isHindi ? 'अपना सुरक्षित PIN सेट करें' : 'Set your secure PIN');

  return (
    <div style={{ minHeight: '100vh', background: c.page, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: 20 }}>
        <h1 style={{ marginTop: 0, textAlign: 'center' }}>{heading}</h1>
        <p style={{ textAlign: 'center', color: c.textMuted }}>
          {step === 'confirm'
            ? tx('pin.confirmSubtext', isHindi ? 'PIN दोबारा दर्ज करें' : 'Re-enter your PIN to confirm')
            : tx('pin.setSubtext', isHindi ? 'ऐप को जल्दी अनलॉक करने के लिए उपयोग किया जाएगा' : 'Used to unlock the app quickly')}
        </p>
        <div style={{ marginTop: 20 }}>
          {step === 'enter' ? renderBoxes(pin, setPin, enterRefs) : renderBoxes(confirmPin, setConfirmPin, confirmRefs)}
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, minHeight: 20, color: error ? c.error : c.textSoft }}>
          {error || tx('pin.hint', isHindi ? '4 अंकों का PIN दर्ज करें' : 'Enter a 4-digit PIN')}
        </p>
      </div>
    </div>
  );
}
