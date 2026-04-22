import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function ChargingSessionScreen({
  session = {},
  unreadCount = 0,
  loading = false,
  onOpenChat,
  onStopCharging,
  onEmergencyStop,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';

  const [elapsedSec, setElapsedSec] = useState(0);
  const [targetKwh, setTargetKwh] = useState(Number(session?.kwhDelivered || 0));
  const [targetPower, setTargetPower] = useState(Number(session?.powerKw || 7.2));
  const [targetCost, setTargetCost] = useState(0);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopPin, setStopPin] = useState('');
  const pinRefs = useRef([]);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const [startedAtFallback] = useState(() => Date.now());
  const startedAtMs = useMemo(() => {
    const raw = session?.startedAt;
    if (!raw) return startedAtFallback;
    const d = raw?.toDate?.() || (raw instanceof Date ? raw : (typeof raw === 'number' ? new Date(raw) : null));
    return d?.getTime?.() || startedAtFallback;
  }, [session?.startedAt, startedAtFallback]);

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  useEffect(() => {
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetKwh(Number(session?.kwhDelivered || 0));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetPower(Number(session?.powerKw || 7.2));
  }, [session?.kwhDelivered, session?.powerKw]);

  useEffect(() => {
    const rate = Number(session?.ratePerKwh || 22);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetCost(Number(session?.kwhDelivered || 0) * rate);
  }, [session?.kwhDelivered, session?.ratePerKwh]);

  const displayKwh = useAnimatedNumber(targetKwh, 500);
  const displayPower = useAnimatedNumber(targetPower, 500);
  const displayCost = useAnimatedNumber(targetCost, 500);

  const hhmmss = formatHHMMSS(elapsedSec);
  const ratePerKwh = Number(session?.ratePerKwh || 22);
  const remaining = session?.estimatedRemaining || '00:42:00';
  const mode = session?.mode || 'FAST';
  const targetCapacity = Number(session?.targetKwh || 24);
  const fillPct = Math.max(0, Math.min(100, (displayKwh / Math.max(1, targetCapacity)) * 100));
  const s = makeStyles(c);

  function handlePinChange(i, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = stopPin.padEnd(4, ' ').split('');
    arr[i] = digit || ' ';
    const next = arr.join('').replace(/\s+$/g, '');
    setStopPin(next);
    if (digit && i < 3) pinRefs.current[i + 1]?.focus();
  }

  function confirmStop() {
    if (stopPin.length !== 4 || loading) return;
    onStopCharging?.(stopPin);
    setStopOpen(false);
    setStopPin('');
  }

  return (
    <div style={s.page}>
      <div style={s.content}>
        <div style={s.header}>
          <div style={s.statusRow}>
            <span style={s.statusDot} />
            <span style={s.statusText}>{tx('charging.active', isHindi ? 'सेशन चालू' : 'Session Active')}</span>
          </div>
          <div style={s.timer}>{hhmmss}</div>
        </div>

        <div style={s.mainCard}>
          <div style={s.bigStat}>
            <span style={s.bigValue}>{displayKwh.toFixed(2)}</span>
            <span style={s.bigLabel}>kWh {tx('charging.delivered', isHindi ? 'डिलीवर' : 'delivered')}</span>
          </div>
          <div style={s.midStatsRow}>
            <div style={s.midStat}><span style={s.midVal}>{displayPower.toFixed(1)}</span><span style={s.midLbl}>kW</span></div>
            <div style={s.midStat}><span style={s.midVal}>₹{displayCost.toFixed(0)}</span><span style={s.midLbl}>{tx('charging.costSoFar', isHindi ? 'अब तक' : 'cost so far')}</span></div>
          </div>
        </div>

        <div style={s.batteryWrap}>
          <div style={s.batteryBody}>
            <div style={{ ...s.batteryFill, height: `${fillPct}%` }} />
            <div style={s.bolt}>⚡</div>
          </div>
          <div style={s.batteryCap} />
          <div style={s.fillPct}>{Math.round(fillPct)}%</div>
        </div>

        <div style={s.detailsRow}>
          <MiniCard s={s} label={tx('charging.mode', isHindi ? 'मोड' : 'Mode')} value={mode} />
          <MiniCard s={s} label={tx('charging.rate', isHindi ? 'रेट' : 'Rate')} value={`₹${ratePerKwh}/kWh`} />
          <MiniCard s={s} label={tx('charging.remaining', isHindi ? 'बाकी' : 'Est. remaining')} value={remaining} />
        </div>
      </div>

      <button disabled={loading} style={{ ...s.chatFab, opacity: loading ? 0.6 : 1 }} onClick={() => onOpenChat?.()} aria-label="Chat">
        💬
        {unreadCount > 0 && <span style={s.chatBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      <div style={s.bottomWrap}>
        <button disabled={loading} style={{ ...s.stopBtn, opacity: loading ? 0.6 : 1 }} onClick={() => setStopOpen(true)}>
          {tx('charging.stop', isHindi ? 'चार्जिंग रोकें' : 'Stop Charging')}
        </button>
        <button disabled={loading} style={{ ...s.emergencyLink, opacity: loading ? 0.6 : 1 }} onClick={() => onEmergencyStop?.()}>
          {tx('charging.emergency', isHindi ? 'इमरजेंसी स्टॉप — होस्ट ऑफलाइन?' : 'Emergency stop — host offline?')}
        </button>
      </div>

      {stopOpen && (
        <div style={s.modalOverlay} onClick={() => setStopOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>{tx('charging.confirmStop', isHindi ? 'क्या आप सुनिश्चित हैं?' : 'Are you sure?')}</h3>
            <p style={s.modalText}>{tx('charging.enterStopPin', isHindi ? 'सेशन खत्म करने के लिए स्टॉप PIN दर्ज करें' : 'Enter stop PIN to end session')}</p>

            <div style={s.pinRow}>
              {[0, 1, 2, 3].map((i) => {
                const filled = i < stopPin.length;
                return (
                  <div key={i} style={{ ...s.pinBox, borderColor: filled ? c.brandPrimary : c.border }}>
                    <div style={{ ...s.pinDot, opacity: filled ? 1 : 0 }} />
                    <input
                      ref={(el) => (pinRefs.current[i] = el)}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={filled ? '•' : ''}
                      onChange={(e) => handlePinChange(i, e.target.value)}
                      style={s.pinInput}
                    />
                  </div>
                );
              })}
            </div>

            <div style={s.modalActions}>
              <button style={s.modalGhost} onClick={() => setStopOpen(false)}>{tx('common.cancel', isHindi ? 'रद्द करें' : 'Cancel')}</button>
              <button style={{ ...s.modalDanger, opacity: stopPin.length === 4 ? 1 : 0.4 }} onClick={confirmStop} disabled={stopPin.length !== 4}>
                {tx('charging.endSession', isHindi ? 'सेशन खत्म करें' : 'End Session')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCard({ s, label, value }) {
  return (
    <div style={s.miniCard}>
      <span style={s.miniVal}>{value}</span>
      <span style={s.miniLbl}>{label}</span>
    </div>
  );
}

function useAnimatedNumber(target, duration = 600) {
  const [value, setValue] = useState(Number(target) || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = Number(value) || 0;
    const to = Number(target) || 0;
    if (Math.abs(to - from) < 0.0001) return undefined;

    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function formatHHMMSS(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function makeStyles(c) {
  return {
    page: { minHeight: '100dvh', background: c.page, color: c.text, position: 'relative' },
    content: { padding: '22px 16px 130px' },
    header: { marginBottom: 14 },
    statusRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
    statusDot: { width: 8, height: 8, borderRadius: '50%', background: c.success },
    statusText: { fontSize: 13, color: c.success, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' },
    timer: { fontSize: 38, fontWeight: 800, letterSpacing: '.06em' },
    mainCard: { borderRadius: 16, border: `1px solid ${c.border}`, background: c.surface, padding: '14px', marginBottom: 16 },
    bigStat: { marginBottom: 10 },
    bigValue: { display: 'block', fontSize: 44, lineHeight: 1, fontWeight: 800, color: c.brandPrimary },
    bigLabel: { display: 'block', marginTop: 4, fontSize: 13, color: c.textMuted },
    midStatsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    midStat: { borderRadius: 12, border: `1px solid ${c.border}`, background: c.surfaceRaised, padding: '10px' },
    midVal: { display: 'block', fontSize: 22, fontWeight: 700 },
    midLbl: { display: 'block', marginTop: 2, fontSize: 11, color: c.textSoft },
    batteryWrap: { marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' },
    batteryBody: {
      width: 118,
      height: 178,
      borderRadius: 14,
      border: `2px solid ${c.borderStrong}`,
      background: c.surfaceRaised,
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    batteryFill: { position: 'absolute', left: 0, right: 0, bottom: 0, background: c.brandPrimary, transition: 'height 700ms ease' },
    bolt: { position: 'relative', zIndex: 1, color: c.surfaceInverse, fontSize: 34, fontWeight: 700 },
    batteryCap: { width: 42, height: 8, borderRadius: 4, background: c.borderStrong, marginTop: 6 },
    fillPct: { marginTop: 8, color: c.brandPrimary, fontWeight: 700, fontSize: 14 },
    detailsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 },
    miniCard: { borderRadius: 12, border: `1px solid ${c.border}`, background: c.surfaceRaised, padding: '10px 8px', textAlign: 'center' },
    miniVal: { display: 'block', color: c.text, fontWeight: 700, fontSize: 13 },
    miniLbl: { display: 'block', marginTop: 2, color: c.textSoft, fontSize: 10 },
    chatFab: {
      position: 'fixed',
      right: 16,
      bottom: 132,
      width: 54,
      height: 54,
      borderRadius: '50%',
      border: `1px solid ${c.brandPrimary}`,
      background: c.surface,
      color: c.brandPrimary,
      fontSize: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      background: c.error,
      color: c.surfaceInverse,
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 4px',
      border: `1.5px solid ${c.page}`,
    },
    bottomWrap: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      padding: '10px 16px 16px',
      borderTop: `1px solid ${c.border}`,
      background: c.surface,
    },
    stopBtn: {
      width: '100%',
      borderRadius: 12,
      border: `1px solid ${c.error}`,
      background: c.errorSoft,
      color: c.error,
      padding: '12px 14px',
      fontSize: 15,
      fontWeight: 700,
    },
    emergencyLink: {
      marginTop: 8,
      width: '100%',
      border: 'none',
      background: 'transparent',
      color: c.textMuted,
      fontSize: 12,
      textDecoration: 'underline',
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: c.overlay,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 40,
      padding: 16,
    },
    modal: { width: '100%', maxWidth: 380, borderRadius: 14, border: `1px solid ${c.borderStrong}`, background: c.surface, padding: '14px' },
    modalTitle: { margin: '0 0 6px', fontSize: 18, color: c.text },
    modalText: { margin: '0 0 12px', color: c.textMuted, fontSize: 13, lineHeight: 1.4 },
    pinRow: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 },
    pinBox: {
      width: 54,
      height: 58,
      borderRadius: 12,
      border: `2px solid ${c.border}`,
      background: c.surfaceRaised,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinDot: { width: 12, height: 12, borderRadius: '50%', background: c.brandPrimary },
    pinInput: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent' },
    modalActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
    modalGhost: { borderRadius: 10, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, padding: '10px', fontWeight: 600 },
    modalDanger: { borderRadius: 10, border: 'none', background: c.error, color: c.page, padding: '10px', fontWeight: 700 },
  };
}
