import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';

const MODES = [
  { id: 'ECO', speed: 'Slow', multiplier: 0.95, eta80: '2h 40m' },
  { id: 'FAST', speed: 'Balanced', multiplier: 1.0, eta80: '1h 35m' },
  { id: 'TURBO', speed: 'High', multiplier: 1.2, eta80: '58m' },
];

/**
 * Screen 09 — Request Screen (User)
 *
 * Props:
 *  host: { name, avatar, rating, chargerType }
 *  charger: { pricePerKwh, typicalSessionKwh, upiId }
 *  onBack()
 *  onSendRequest(payload)
 *  loading
 */
export default function RequestScreen({
  host = {},
  charger = {},
  onBack,
  onSendRequest,
  loading = false,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const [selectedMode, setSelectedMode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [upiInput, setUpiInput] = useState(charger?.upiId || '');
  const [upiOption, setUpiOption] = useState('UPI_ID');

  const modeObj = MODES.find((m) => m.id === selectedMode) || null;
  const basePricePerKwh = Number(charger?.pricePerKwh || 22);
  const typicalKwh = Number(charger?.typicalSessionKwh || 12);

  const estimate = useMemo(() => {
    if (!modeObj) return null;
    const perKwh = basePricePerKwh * modeObj.multiplier;
    const base = perKwh * typicalKwh;
    const low = Math.max(0, Math.round(base * 0.82));
    const high = Math.round(base * 1.18);
    return {
      perKwh: Math.round(perKwh * 10) / 10,
      low,
      high,
    };
  }, [modeObj, basePricePerKwh, typicalKwh]);

  const discountAmt = appliedPromo && estimate ? Math.round((estimate.high - estimate.low) * 0.1) : 0;

  function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setAppliedPromo({ code, percent: 10 });
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput('');
  }

  function handleSendRequest() {
    if (!modeObj || loading) return;
    onSendRequest?.({
      mode: modeObj.id,
      paymentMethod,
      promo: appliedPromo?.code || null,
      upi: paymentMethod === 'UPI' ? { option: upiOption, upiId: upiInput } : null,
      estimate,
    });
  }

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <header style={s.header}>
        <button style={s.backBtn} onClick={() => onBack?.()} aria-label="Back">
          <ArrowLeft />
        </button>
        <h1 style={s.title}>{tx('request.title', isHindi ? 'चार्ज रिक्वेस्ट' : 'Request Charge')}</h1>
        <div style={{ width: 36 }} />
      </header>

      <div style={s.content}>
        <section style={s.hostCard}>
          {host?.avatar
            ? <img src={host.avatar} alt="" style={s.hostAvatar} referrerPolicy="no-referrer" />
            : <div style={s.hostAvatarFallback}>{initials(host?.name)}</div>}
          <div style={s.hostInfo}>
            <p style={s.hostName}>{host?.name || tx('request.host', 'Host')}</p>
            <p style={s.hostMeta}>★ {host?.rating ?? 4.7} · {host?.chargerType || charger?.connectorType || 'Type 2'}</p>
          </div>
        </section>

        <SectionTitle text={tx('request.chargingMode', isHindi ? 'चार्जिंग मोड' : 'Charging Mode')} />
        <section style={s.segmentWrap}>
          {MODES.map((m) => {
            const active = selectedMode === m.id;
            const p = Math.round(basePricePerKwh * m.multiplier * 10) / 10;
            return (
              <button
                key={m.id}
                style={{
                  ...s.segment,
                  background: active ? '#00D4AA' : 'rgba(255,255,255,0.05)',
                  borderColor: active ? '#00D4AA' : 'rgba(255,255,255,0.12)',
                }}
                onClick={() => setSelectedMode(m.id)}
              >
                <span style={{ ...s.segTop, color: active ? '#0A0A0F' : '#fff' }}>{m.id}</span>
                <span style={{ ...s.segMeta, color: active ? 'rgba(10,10,15,0.8)' : 'rgba(255,255,255,0.55)' }}>{m.speed}</span>
                <span style={{ ...s.segMeta, color: active ? 'rgba(10,10,15,0.8)' : 'rgba(255,255,255,0.55)' }}>₹{p}/kWh</span>
                <span style={{ ...s.segMeta, color: active ? 'rgba(10,10,15,0.8)' : 'rgba(255,255,255,0.55)' }}>{tx('request.eta80', isHindi ? '80% समय' : '80% ETA')}: {m.eta80}</span>
              </button>
            );
          })}
        </section>

        <SectionTitle text={tx('request.estimatedCost', isHindi ? 'अनुमानित लागत' : 'Estimated Cost')} />
        <section style={s.costCard}>
          <p style={s.costRange}>
            {estimate ? `₹${estimate.low} - ₹${estimate.high}` : '₹— - ₹—'}
          </p>
          <p style={s.costHint}>
            {tx('request.costHint', isHindi ? 'वास्तविक लागत उपयोग पर निर्भर करेगी' : 'Actual amount may vary based on usage')}
          </p>
          {appliedPromo && estimate && (
            <p style={s.discountText}>
              {tx('request.discount', isHindi ? 'छूट लागू' : 'Discount applied')}: -₹{discountAmt} ({appliedPromo.code})
            </p>
          )}
        </section>

        <SectionTitle text={tx('request.promo', isHindi ? 'प्रोमो कोड' : 'Promo Code')} />
        <section style={s.card}>
          <button style={s.collapseBtn} onClick={() => setPromoOpen((v) => !v)}>
            <span>{promoOpen ? '−' : '+'}</span>
            <span>{promoOpen ? tx('request.hidePromo', isHindi ? 'प्रोमो छुपाएं' : 'Hide promo') : tx('request.addPromo', isHindi ? 'प्रोमो जोड़ें' : 'Add promo')}</span>
          </button>

          {promoOpen && (
            <div style={s.promoRow}>
              <input
                style={s.input}
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder={tx('request.enterPromo', isHindi ? 'कोड डालें' : 'Enter code')}
              />
              {!appliedPromo ? (
                <button style={s.applyBtn} onClick={applyPromo}>{tx('request.apply', isHindi ? 'लागू करें' : 'Apply')}</button>
              ) : (
                <button style={s.removeBtn} onClick={removePromo}>{tx('request.remove', isHindi ? 'हटाएं' : 'Remove')}</button>
              )}
            </div>
          )}
        </section>

        <SectionTitle text={tx('request.paymentMethod', isHindi ? 'पेमेंट तरीका' : 'Payment Method')} />
        <section style={s.card}>
          <div style={s.toggleRow}>
            <button
              style={{ ...s.toggleBtn, ...(paymentMethod === 'CASH' ? s.toggleActive : null) }}
              onClick={() => setPaymentMethod('CASH')}
            >
              {tx('request.cash', 'Cash')}
            </button>
            <button
              style={{ ...s.toggleBtn, ...(paymentMethod === 'UPI' ? s.toggleActive : null) }}
              onClick={() => setPaymentMethod('UPI')}
            >
              UPI
            </button>
          </div>

          {paymentMethod === 'UPI' && (
            <div style={s.upiWrap}>
              <div style={s.toggleRow}>
                <button
                  style={{ ...s.smallToggle, ...(upiOption === 'UPI_ID' ? s.smallActive : null) }}
                  onClick={() => setUpiOption('UPI_ID')}
                >UPI ID</button>
                <button
                  style={{ ...s.smallToggle, ...(upiOption === 'QR' ? s.smallActive : null) }}
                  onClick={() => setUpiOption('QR')}
                >QR</button>
              </div>

              {upiOption === 'UPI_ID' ? (
                <input
                  style={s.input}
                  placeholder="name@bank"
                  value={upiInput}
                  onChange={(e) => setUpiInput(e.target.value)}
                />
              ) : (
                <div style={s.qrBox}>QR {tx('request.option', isHindi ? 'विकल्प' : 'Option')}</div>
              )}
            </div>
          )}
        </section>
      </div>

      <div style={s.footer}>
        <button
          style={{
            ...s.sendBtn,
            opacity: selectedMode && !loading ? 1 : 0.45,
            cursor: selectedMode && !loading ? 'pointer' : 'not-allowed',
          }}
          disabled={!selectedMode || loading}
          onClick={handleSendRequest}
        >
          {loading
            ? tx('request.sending', isHindi ? 'भेजा जा रहा है...' : 'Sending...')
            : tx('request.send', isHindi ? 'रिक्वेस्ट भेजें' : 'Send Request')}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ text }) {
  return <h2 style={s.sectionTitle}>{text}</h2>;
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M15 5L8 12L15 19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

const cssText = `
  * { box-sizing: border-box; }
  button { font-family: 'Inter', sans-serif; }
  input { font-family: 'Inter', sans-serif; }
`;

const s = {
  page: {
    minHeight: '100dvh',
    background: '#0A0A0F',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 14px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    position: 'sticky',
    top: 0,
    background: 'rgba(10,10,15,0.96)',
    backdropFilter: 'blur(8px)',
    zIndex: 5,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, margin: 0 },

  content: {
    flex: 1,
    padding: '14px 14px 110px',
    overflowY: 'auto',
  },

  hostCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  hostAvatar: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(0,212,170,0.4)',
  },
  hostAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    background: 'rgba(0,212,170,0.18)',
    color: '#00D4AA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  hostInfo: { minWidth: 0 },
  hostName: { margin: '0 0 2px', fontWeight: 700, fontSize: 15 },
  hostMeta: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)' },

  sectionTitle: {
    margin: '14px 0 8px',
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
  },

  segmentWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  segment: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    textAlign: 'left',
    padding: '10px 9px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  segTop: { fontSize: 13, fontWeight: 700 },
  segMeta: { fontSize: 10 },

  costCard: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    padding: '12px',
  },
  costRange: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#00D4AA' },
  costHint: { margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  discountText: { margin: '8px 0 0', fontSize: 12, color: '#22C55E', fontWeight: 600 },

  card: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    padding: '12px',
  },
  collapseBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'rgba(255,255,255,0.88)',
    background: 'transparent',
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  promoRow: {
    marginTop: 10,
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
  },
  input: {
    width: '100%',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(10,10,15,0.65)',
    color: '#fff',
    fontSize: 13,
    padding: '10px 11px',
    outline: 'none',
  },
  applyBtn: {
    borderRadius: 10,
    border: 'none',
    background: '#00D4AA',
    color: '#0A0A0F',
    padding: '10px 12px',
    fontWeight: 700,
  },
  removeBtn: {
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#FF7A8E',
    padding: '10px 12px',
    fontWeight: 600,
  },

  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(10,10,15,0.6)',
    color: 'rgba(255,255,255,0.85)',
    padding: '10px 12px',
    fontWeight: 600,
  },
  toggleActive: {
    background: '#00D4AA',
    borderColor: '#00D4AA',
    color: '#0A0A0F',
    fontWeight: 700,
  },

  upiWrap: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  smallToggle: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(10,10,15,0.65)',
    color: 'rgba(255,255,255,0.8)',
    padding: '7px 12px',
    fontSize: 12,
  },
  smallActive: {
    background: 'rgba(0,212,170,0.2)',
    borderColor: '#00D4AA',
    color: '#00D4AA',
    fontWeight: 700,
  },
  qrBox: {
    borderRadius: 10,
    border: '1px dashed rgba(255,255,255,0.25)',
    color: 'rgba(255,255,255,0.6)',
    padding: '15px',
    textAlign: 'center',
    fontSize: 13,
  },

  footer: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '10px 14px 16px',
    background: 'rgba(10,10,15,0.97)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: '100%',
    borderRadius: 12,
    border: 'none',
    background: '#00D4AA',
    color: '#0A0A0F',
    padding: '13px 14px',
    fontSize: 15,
    fontWeight: 700,
  },
};
