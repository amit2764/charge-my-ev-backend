import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';

/**
 * Screen 10 — Matching Screen (User, Web)
 *
 * Props:
 *  host: { name, avatar, chargerType, powerKw }
 *  expiresInSeconds?: number (default 58)
 *  onCancelRequest()
 *  onExpire()
 *  onValidateVisibility() // optional hook to let parent re-check routing state
 */
export default function MatchingScreen({
  host = {},
  expiresInSeconds = 58,
  onCancelRequest,
  onExpire,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Number(expiresInSeconds) || 58));

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.();
      return undefined;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, onExpire]);

  const timerText = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = String(secondsLeft % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }, [secondsLeft]);

  const hostName = host?.name || tx('matching.host', 'Host');

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <div style={s.centerWrap}>
        <div style={s.radarWrap} aria-hidden="true">
          <span style={{ ...s.ring, animationDelay: '0ms' }} />
          <span style={{ ...s.ring, animationDelay: '400ms' }} />
          <span style={{ ...s.ring, animationDelay: '800ms' }} />
          <div style={s.boltCore}>⚡</div>
        </div>

        <h1 style={s.heading}>{tx('matching.heading', isHindi ? 'होस्ट ढूंढ रहे हैं...' : 'Finding your host...')}</h1>
        <p style={s.subtext}>
          {tx('matching.subtextPrefix', isHindi ? 'हमने आपकी रिक्वेस्ट भेज दी है' : "We've sent your request to")}{' '}
          <strong style={{ color: '#fff' }}>{hostName}</strong>
        </p>

        <p style={s.timer}>
          {tx('matching.expiresIn', isHindi ? 'समाप्त होगा' : 'Expires in')} <span style={s.timerVal}>{timerText}</span>
        </p>

        <div style={s.hostCard}>
          {host?.avatar
            ? <img src={host.avatar} alt="" style={s.avatar} referrerPolicy="no-referrer" />
            : <div style={s.avatarFallback}>{initials(hostName)}</div>}
          <div style={s.hostTextWrap}>
            <p style={s.hostName}>{hostName}</p>
            <p style={s.hostMeta}>{host?.chargerType || 'Type 2'} {host?.powerKw ? `· ${host.powerKw}kW` : ''}</p>
          </div>
        </div>
      </div>

      <div style={s.bottomWrap}>
        <button style={s.cancelBtn} onClick={() => onCancelRequest?.()}>
          {tx('matching.cancel', isHindi ? 'रिक्वेस्ट रद्द करें' : 'Cancel Request')}
        </button>
      </div>
    </div>
  );
}

function initials(name = '') {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
}

const cssText = `
  * { box-sizing: border-box; }
  @keyframes radarPulse {
    0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
  }
`;

const s = {
  page: {
    minHeight: '100dvh',
    background: '#0A0A0F',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '24px 18px 18px',
  },
  centerWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  radarWrap: {
    width: 196,
    height: 196,
    position: 'relative',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 96,
    height: 96,
    borderRadius: '50%',
    border: '2px solid rgba(0,212,170,0.62)',
    transform: 'translate(-50%, -50%) scale(1)',
    opacity: 0.6,
    animation: 'radarPulse 1.2s ease-out infinite',
    pointerEvents: 'none',
  },
  boltCore: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'rgba(0,212,170,0.18)',
    border: '1px solid rgba(0,212,170,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    color: '#00D4AA',
    boxShadow: '0 0 28px rgba(0,212,170,0.25)',
  },

  heading: {
    margin: '0 0 8px',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtext: {
    margin: '0 0 16px',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    maxWidth: 320,
    lineHeight: 1.45,
  },
  timer: {
    margin: '0 0 18px',
    fontSize: 14,
    color: 'rgba(255,255,255,0.74)',
  },
  timerVal: {
    color: '#00D4AA',
    fontWeight: 700,
    letterSpacing: '0.03em',
  },

  hostCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(0,212,170,0.4)',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(0,212,170,0.2)',
    color: '#00D4AA',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostTextWrap: { minWidth: 0 },
  hostName: {
    margin: '0 0 2px',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  hostMeta: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.54)',
  },

  bottomWrap: {
    paddingTop: 10,
  },
  cancelBtn: {
    width: '100%',
    borderRadius: 12,
    border: '1px solid rgba(255,107,129,0.45)',
    background: 'transparent',
    color: '#FF6B81',
    padding: '12px 14px',
    fontSize: 14,
    fontWeight: 700,
  },
};
