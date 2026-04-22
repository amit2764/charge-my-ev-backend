import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store';

export default function BookingConfirmScreen({
  role = 'user',
  booking = {},
  counterparty = {},
  startPin = '',
  loading = false,
  onSubmitStartPin,
  onDirections,
  onReady,
  onSharePin,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const { activeBooking, activeBookingRole } = useStore();
  const isHindi = locale === 'hi';

  const [copiedId, setCopiedId] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [userPin, setUserPin] = useState('');
  const pinRefs = useRef([]);

  const resolvedBooking = booking?.id ? booking : (activeBooking || {});
  const resolvedRole = role || activeBookingRole || 'user';

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const fullBookingId = String(resolvedBooking?.id || '');
  const shortBookingId = useMemo(() => {
    if (!fullBookingId) return '—';
    if (fullBookingId.length <= 10) return fullBookingId;
    return `${fullBookingId.slice(0, 6)}...${fullBookingId.slice(-4)}`;
  }, [fullBookingId]);

  const startTimeText = useMemo(() => {
    const raw = resolvedBooking?.estimatedStartTime;
    if (!raw) return '—';
    if (typeof raw === 'string') return raw;
    const d = raw?.toDate?.() || (raw instanceof Date ? raw : null);
    if (!d) return '—';
    return d.toLocaleTimeString(isHindi ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' });
  }, [resolvedBooking?.estimatedStartTime, isHindi]);

  const whoLabel = resolvedRole === 'host'
    ? tx('confirm.user', isHindi ? 'यूज़र' : 'User')
    : tx('confirm.host', isHindi ? 'होस्ट' : 'Host');

  async function copyText(text, type = 'id') {
    if (!text || loading) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 1200);
      } else {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 1200);
      }
    } catch {
      // Ignore clipboard failures.
    }
  }

  function handlePinChange(i, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = userPin.padEnd(4, ' ').split('');
    arr[i] = digit || ' ';
    const next = arr.join('').replace(/\s+$/g, '');
    setUserPin(next);
    if (digit && i < 3) pinRefs.current[i + 1]?.focus();
    if (next.length === 4 && onSubmitStartPin) onSubmitStartPin(next);
  }

  const s = makeStyles(c);

  return (
    <div style={s.page}>
      <style>{`
        @keyframes checkPop {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 0.18; }
        }
      `}</style>

      <div style={s.content}>
        <div style={s.successWrap} aria-hidden="true">
          <div style={s.successRing} />
          <div style={s.successCheck}>✓</div>
        </div>

        <h1 style={s.heading}>{tx('confirm.heading', isHindi ? 'बुकिंग कन्फर्म!' : 'Booking Confirmed!')}</h1>

        <section style={s.card}>
          <div style={s.partyRow}>
            {counterparty?.avatar
              ? <img src={counterparty.avatar} alt="" style={s.avatar} referrerPolicy="no-referrer" />
              : <div style={s.avatarFallback}>{initials(counterparty?.name || whoLabel)}</div>}
            <div style={s.partyTextWrap}>
              <p style={s.partyName}>{counterparty?.name || whoLabel}</p>
              <p style={s.partyMeta}>{resolvedBooking?.chargerType || 'Type 2'} · {resolvedBooking?.chargingMode || 'FAST'}</p>
            </div>
          </div>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>{tx('confirm.startTime', isHindi ? 'शुरुआती समय' : 'Estimated start time')}</span>
            <span style={s.metaVal}>{startTimeText}</span>
          </div>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>{tx('confirm.bookingId', isHindi ? 'बुकिंग ID' : 'Booking ID')}</span>
            <button disabled={loading} style={{ ...s.copyBtn, opacity: loading ? 0.6 : 1 }} onClick={() => copyText(fullBookingId, 'id')}>
              <span>{shortBookingId}</span>
              <span style={{ color: copiedId ? c.success : c.brandPrimary }}>{copiedId ? tx('confirm.copied', isHindi ? 'कॉपी' : 'Copied') : tx('confirm.copy', isHindi ? 'कॉपी' : 'Copy')}</span>
            </button>
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>{tx('confirm.instructions', isHindi ? 'निर्देश' : 'Instructions')}</h2>
          <p style={s.instructionsText}>
            {resolvedRole === 'user'
              ? tx('confirm.userInstruction', isHindi ? 'चार्जर लोकेशन पर जाएं और तैयार होने पर स्टार्ट PIN दर्ज करें।' : 'Go to the charger location and enter the start PIN when ready.')
              : tx('confirm.hostInstruction', isHindi ? 'यूज़र रास्ते में है। आने पर स्टार्ट PIN साझा करें।' : 'User is on their way. Share the start PIN when they arrive.')}
          </p>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>{tx('confirm.startPin', isHindi ? 'स्टार्ट PIN' : 'Start PIN')}</h2>

          {resolvedRole === 'host' ? (
            <>
              <div style={s.hostPinDisplay}>{(startPin || '----').split('').join(' ')}</div>
              <div style={s.hostPinActions}>
                <button disabled={loading} style={{ ...s.ghostBtn, opacity: loading ? 0.6 : 1 }} onClick={() => copyText(startPin, 'pin')}>
                  {copiedPin ? tx('confirm.copied', isHindi ? 'कॉपी' : 'Copied') : tx('confirm.copyPin', isHindi ? 'PIN कॉपी करें' : 'Copy PIN')}
                </button>
                <button disabled={loading} style={{ ...s.primaryBtn, opacity: loading ? 0.6 : 1 }} onClick={() => onSharePin?.(startPin)}>
                  {tx('confirm.sharePin', isHindi ? 'PIN शेयर करें' : 'Share PIN')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={s.pinRow}>
                {[0, 1, 2, 3].map((i) => {
                  const filled = i < userPin.length;
                  return (
                    <div key={i} style={{ ...s.pinBox, borderColor: filled ? c.brandPrimary : c.border }}>
                      <div style={{ ...s.pinDot, opacity: filled ? 1 : 0 }} />
                      <input
                        ref={(el) => (pinRefs.current[i] = el)}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        disabled={loading}
                        value={filled ? '•' : ''}
                        onChange={(e) => handlePinChange(i, e.target.value)}
                        style={s.pinInput}
                        aria-label={`PIN digit ${i + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
              <button
                style={{ ...s.primaryBtn, marginTop: 10, opacity: userPin.length === 4 && !loading ? 1 : 0.4 }}
                disabled={userPin.length !== 4 || loading}
                onClick={() => onSubmitStartPin?.(userPin)}
              >
                {tx('confirm.submitPin', isHindi ? 'PIN सबमिट करें' : 'Submit PIN')}
              </button>
            </>
          )}
        </section>
      </div>

      <div style={s.bottomWrap}>
        <button disabled={loading} style={{ ...s.bottomPrimary, opacity: loading ? 0.6 : 1 }} onClick={() => (resolvedRole === 'user' ? onDirections?.() : onReady?.())}>
          {resolvedRole === 'user'
            ? tx('confirm.getDirections', isHindi ? 'दिशा देखें' : 'Get Directions')
            : tx('confirm.imReady', isHindi ? 'मैं तैयार हूं' : "I'm Ready")}
        </button>
      </div>
    </div>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return {
    page: {
      minHeight: '100dvh',
      background: c.page,
      color: c.text,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    content: {
      padding: '24px 16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    },
    successWrap: {
      width: 92,
      height: 92,
      margin: '0 auto 4px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successRing: {
      position: 'absolute',
      width: 92,
      height: 92,
      borderRadius: '50%',
      border: `2px solid ${c.brandPrimary}`,
      animation: 'ringPulse 2s ease-in-out infinite',
    },
    successCheck: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: c.successSoft,
      border: `1px solid ${c.success}`,
      color: c.success,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 34,
      fontWeight: 700,
      animation: 'checkPop 520ms cubic-bezier(0.34,1.56,0.64,1) forwards',
      boxShadow: `0 0 24px ${c.successSoft}`,
    },
    heading: { margin: 0, textAlign: 'center', fontSize: 26, lineHeight: 1.2, fontWeight: 700 },
    card: { borderRadius: 14, border: `1px solid ${c.border}`, background: c.surface, padding: 12 },
    sectionTitle: { margin: '0 0 8px', fontSize: 14, color: c.text, fontWeight: 700 },
    partyRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
    avatar: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c.brandPrimary}` },
    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: c.brandPrimarySoft,
      color: c.brandPrimary,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    partyTextWrap: { minWidth: 0 },
    partyName: { margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: c.text },
    partyMeta: { margin: 0, fontSize: 12, color: c.textMuted },
    metaRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
    metaLabel: { fontSize: 12, color: c.textSoft },
    metaVal: { fontSize: 13, color: c.text, fontWeight: 600 },
    copyBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: c.text,
      fontSize: 13,
      fontWeight: 600,
      border: 'none',
      background: 'transparent',
      padding: 0,
      cursor: 'pointer',
    },
    instructionsText: { margin: 0, fontSize: 13, lineHeight: 1.45, color: c.textMuted },
    hostPinDisplay: { fontSize: 38, letterSpacing: 6, textAlign: 'center', color: c.brandPrimary, fontWeight: 800, margin: '4px 0 12px' },
    hostPinActions: { display: 'flex', gap: 8 },
    pinRow: { display: 'flex', gap: 10, justifyContent: 'center' },
    pinBox: {
      width: 56,
      height: 64,
      borderRadius: 12,
      border: `2px solid ${c.border}`,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: c.surfaceRaised,
    },
    pinDot: { width: 12, height: 12, borderRadius: '50%', background: c.brandPrimary, pointerEvents: 'none' },
    pinInput: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 'none', background: 'transparent', outline: 'none' },
    ghostBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: 999,
      border: `1px solid ${c.borderStrong}`,
      background: c.surfaceRaised,
      color: c.text,
      fontWeight: 700,
      cursor: 'pointer',
    },
    primaryBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: 999,
      border: 'none',
      background: c.brandPrimary,
      color: c.page,
      fontWeight: 700,
      cursor: 'pointer',
    },
    bottomWrap: { padding: '8px 16px 16px' },
    bottomPrimary: {
      width: '100%',
      minHeight: 50,
      borderRadius: 999,
      border: 'none',
      background: c.brandPrimary,
      color: c.page,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
    },
  };
}
