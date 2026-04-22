import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

/**
 * Screen 14 — Rating Screen (Web)
 *
 * Props:
 *  role: 'user' | 'host'
 *  party: { name, avatar }
 *  summary: { kwh, duration, amount }
 *  onSubmitRating({ rating, comment })
 *  onSkip()
 *  onValidateVisibility()
 */
export default function RatingScreen({
  role = 'user',
  party = {},
  summary = {},
  loading = false,
  onSubmitRating,
  onSkip,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const maxChars = 200;
  const otherLabel = role === 'user'
    ? tx('rating.yourHost', isHindi ? 'आपके होस्ट' : 'Your Host')
    : tx('rating.yourUser', isHindi ? 'आपके यूज़र' : 'Your User');

  const displayStars = hover || rating;

  const kwh = typeof summary?.kwh === 'number' ? `${summary.kwh.toFixed(2)} kWh` : (summary?.kwh || '—');
  const duration = summary?.duration || '—';
  const amount = summary?.amount != null ? `₹${Number(summary.amount).toFixed(0)}` : '—';
  const summaryRows = [
    { label: tx('rating.totalKwh', isHindi ? 'कुल kWh' : 'Total kWh'), value: kwh },
    { label: tx('rating.duration', isHindi ? 'अवधि' : 'Duration'), value: duration },
    { label: tx('rating.amountPaid', isHindi ? 'भुगतान राशि' : 'Amount paid'), value: amount },
  ];

  function submit() {
    if (!rating || loading) return;
    onSubmitRating?.({ rating, comment: comment.trim() });
  }

  const s = makeStyles(c);

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <div style={s.content}>
        <div style={s.celeWrap} aria-hidden="true">
          {[...Array(18)].map((_, i) => (
            <span key={i} className="confetti" style={{ ...confettiStyle(i, c) }} />
          ))}
          <div style={s.celeCore}>🎉</div>
        </div>

        <h1 style={s.heading}>{tx('rating.complete', isHindi ? 'सेशन पूरा!' : 'Session Complete!')}</h1>
        <p style={s.subtext}>{tx('rating.rateExperience', isHindi ? 'अपना अनुभव रेट करें' : 'Rate your experience')}</p>

        <div style={s.partyWrap}>
          {party?.avatar
            ? <img src={party.avatar} alt="" style={s.avatar} referrerPolicy="no-referrer" />
            : <div style={s.avatarFallback}>{initials(party?.name || otherLabel)}</div>}
          <p style={s.partyName}>{party?.name || otherLabel}</p>
          <p style={s.partyMeta}>{otherLabel}</p>
        </div>

        <div style={s.starsRow} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= displayStars;
            return (
              <button
                key={n}
                style={{
                  ...s.starBtn,
                  color: active ? c.brandPrimary : c.textSoft,
                  transform: active ? 'scale(1.14)' : 'scale(1)',
                }}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                aria-label={`Rate ${n}`}
              >
                ★
              </button>
            );
          })}
        </div>

        {rating > 0 && (
          <div style={s.commentWrap}>
            <textarea
              style={s.commentInput}
              maxLength={maxChars}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, maxChars))}
              placeholder={tx('rating.commentPlaceholder', isHindi ? 'टिप्पणी जोड़ें...' : 'Add a comment...')}
            />
            <p style={s.counter}>{comment.length}/{maxChars}</p>
          </div>
        )}

        <button
          style={{ ...s.primaryBtn, opacity: rating && !loading ? 1 : 0.45, cursor: rating && !loading ? 'pointer' : 'not-allowed' }}
          disabled={!rating || loading}
          onClick={submit}
        >
          {tx('rating.submit', isHindi ? 'रेटिंग सबमिट करें' : 'Submit Rating')}
        </button>
        <button style={s.ghostBtn} onClick={() => onSkip?.()}>
          {tx('rating.skip', isHindi ? 'स्किप' : 'Skip')}
        </button>

        <div style={s.summaryCard}>
          <button style={s.summaryHeader} onClick={() => setExpanded((v) => !v)}>
            <span>{tx('rating.sessionSummary', isHindi ? 'सेशन सारांश' : 'Session Summary')}</span>
            <span style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms' }}>⌄</span>
          </button>

          {expanded && (
            <div style={s.summaryBody}>
              {summaryRows.map((r) => (
                <div key={r.label} style={s.summaryRow}>
                  <span style={s.summaryLabel}>{r.label}</span>
                  <span style={s.summaryVal}>{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function confettiStyle(i, c) {
  const angle = (i / 18) * Math.PI * 2;
  const x = Math.cos(angle) * (40 + (i % 4) * 6);
  const y = Math.sin(angle) * (40 + (i % 5) * 5);
  const colors = [c.brandPrimary, c.success, c.brandPrimary, c.success];
  return {
    '--x': `${x}px`,
    '--y': `${y}px`,
    background: colors[i % colors.length],
    animationDelay: `${(i % 6) * 70}ms`,
  };
}

const cssText = `
  * { box-sizing: border-box; }
  @keyframes confettiBurst {
    0% { transform: translate(0, 0) scale(0.4) rotate(0deg); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--x), var(--y)) scale(1) rotate(220deg); opacity: 0; }
  }
  @keyframes popIn {
    0% { transform: scale(0.4); opacity: 0; }
    70% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .confetti {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    animation: confettiBurst 1.2s ease-out infinite;
  }
`;

function makeStyles(c) {
  return {
    page: { minHeight: '100dvh', background: c.page, color: c.text, fontFamily: "'Inter', sans-serif" },
    content: { maxWidth: 420, margin: '0 auto', padding: '18px 16px 24px' },
    celeWrap: { width: 112, height: 112, margin: '6px auto 8px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    celeCore: { width: 62, height: 62, borderRadius: '50%', background: c.brandPrimarySoft, border: `1px solid ${c.brandPrimary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, animation: 'popIn 480ms cubic-bezier(0.34,1.56,0.64,1) forwards', boxShadow: `0 0 22px ${c.brandPrimarySoft}` },
    heading: { margin: '0 0 6px', textAlign: 'center', fontSize: 28, lineHeight: 1.2, fontWeight: 800, color: c.text },
    subtext: { margin: '0 0 14px', textAlign: 'center', color: c.textMuted, fontSize: 14 },
    partyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c.brandPrimary}`, marginBottom: 8 },
    avatarFallback: { width: 76, height: 76, borderRadius: '50%', background: c.brandPrimarySoft, border: `2px solid ${c.brandPrimary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: c.brandPrimary, marginBottom: 8 },
    partyName: { margin: '0 0 2px', fontSize: 18, fontWeight: 700, color: c.text },
    partyMeta: { margin: 0, fontSize: 12, color: c.textMuted },
    starsRow: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 },
    starBtn: { border: 'none', background: 'transparent', fontSize: 42, lineHeight: 1, transition: 'transform 120ms, color 120ms', padding: 0, cursor: 'pointer' },
    commentWrap: { marginBottom: 12 },
    commentInput: { width: '100%', minHeight: 88, maxHeight: 130, borderRadius: 12, border: `1px solid ${c.border}`, background: c.surfaceRaised, color: c.text, padding: '10px 11px', fontSize: 13, outline: 'none', resize: 'vertical' },
    counter: { margin: '6px 2px 0', textAlign: 'right', fontSize: 11, color: c.textSoft },
    primaryBtn: { width: '100%', borderRadius: 12, border: 'none', background: c.brandPrimary, color: c.page, padding: '13px 14px', fontSize: 15, fontWeight: 700, marginBottom: 8, cursor: 'pointer' },
    ghostBtn: { width: '100%', border: 'none', background: 'transparent', color: c.textMuted, textDecoration: 'underline', fontSize: 13, marginBottom: 12, cursor: 'pointer' },
    summaryCard: { borderRadius: 12, border: `1px solid ${c.border}`, background: c.surfaceRaised, overflow: 'hidden' },
    summaryHeader: { width: '100%', border: 'none', background: 'transparent', color: c.text, padding: '11px 12px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
    summaryBody: { padding: '0 12px 10px' },
    summaryRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
    summaryLabel: { fontSize: 12, color: c.textMuted },
    summaryVal: { fontSize: 13, fontWeight: 700, color: c.text },
  };
}
