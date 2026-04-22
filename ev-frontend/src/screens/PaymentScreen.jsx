import React, { useEffect } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

/**
 * Screen 13 — Payment Screen (Web)
 *
 * Props:
 *  paymentSubState:
 *    'USER_MUST_CONFIRM' | 'WAITING_FOR_HOST' | 'HOST_MUST_CONFIRM' | 'WAITING_FOR_USER'
 *  role: 'user' | 'host'
 *  amount, durationText, kwhDelivered, ratePerKwh, subtotal, promoDiscount, platformFee, total
 *  paymentMethod: 'CASH' | 'UPI'
 *  upiId
 *  host: { name, avatar }
 *  user: { name, avatar }
 *  elapsedMinutes
 *  autoResolveSecondsRemaining
 *  onUserConfirmPaid()
 *  onHostConfirmReceived()
 *  onOpenChat()
 *  onOpenDispute()
 *  onExitForNow()
 *  onValidateVisibility()
 */
export default function PaymentScreen({
  paymentSubState = 'USER_MUST_CONFIRM',
  durationText,
  kwhDelivered,
  ratePerKwh,
  subtotal,
  promoDiscount = 0,
  platformFee = 0,
  total,
  paymentMethod = 'CASH',
  upiId = '',
  host = {},
  user = {},
  elapsedMinutes = 0,
  autoResolveSecondsRemaining = 0,
  loading = false,
  onUserConfirmPaid,
  onHostConfirmReceived,
  onOpenChat,
  onOpenDispute,
  onExitForNow,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  const autoLeft = Math.max(0, Number(autoResolveSecondsRemaining || 0));

  const hostName = host?.name || tx('payment.host', 'Host');
  const userName = user?.name || tx('payment.user', 'User');
  const durationVal = durationText || '01:12:00';
  const kwhVal = typeof kwhDelivered === 'number' ? `${kwhDelivered.toFixed(2)} kWh` : (kwhDelivered || '—');
  const rateVal = typeof ratePerKwh === 'number' ? `₹${ratePerKwh}/kWh` : (ratePerKwh || '—');
  const subtotalVal = typeof subtotal === 'number' ? subtotal : Number(subtotal || 0);
  const platformFeeVal = typeof platformFee === 'number' ? platformFee : Number(platformFee || 0);
  const totalVal = typeof total === 'number'
    ? total
    : Math.max(0, subtotalVal - Number(promoDiscount || 0) + platformFeeVal);

  const showAutoResolve = Number(elapsedMinutes || 0) > 20 && autoLeft > 0;
  const s = makeStyles(c);
  const css = makeCssText(c);

  return (
    <div style={s.page}>
      <style>{css}</style>

      <div style={s.content}>
        {/* Session summary */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>{tx('payment.summary', isHindi ? 'सेशन सारांश' : 'Session Summary')}</h2>

          <Row s={s} label={tx('payment.duration', isHindi ? 'अवधि' : 'Duration')} value={durationVal} />
          <Row s={s} label={tx('payment.kwh', isHindi ? 'डिलीवर kWh' : 'kWh delivered')} value={kwhVal} />
          <Row s={s} label={tx('payment.rate', isHindi ? 'रेट' : 'Rate')} value={rateVal} />
          <Row s={s} label={tx('payment.subtotal', isHindi ? 'उप-योग' : 'Subtotal')} value={`₹${subtotalVal.toFixed(0)}`} />

          {Number(promoDiscount || 0) > 0 && (
            <Row s={s} label={tx('payment.promo', isHindi ? 'प्रोमो छूट' : 'Promo discount')} value={`-₹${Number(promoDiscount).toFixed(0)}`} valueStyle={{ color: c.success }} />
          )}

          <Row s={s} label={tx('payment.platformFee', isHindi ? 'प्लेटफ़ॉर्म शुल्क' : 'Platform fee')} value={`₹${platformFeeVal.toFixed(0)}`} />

          <div style={s.totalRow}>
            <span style={s.totalLabel}>{tx('payment.total', isHindi ? 'कुल' : 'Total')}</span>
            <span style={s.totalVal}>₹{totalVal.toFixed(0)}</span>
          </div>
        </section>

        {/* Sub-state action panel */}
        <section style={s.card}>
          {paymentSubState === 'USER_MUST_CONFIRM' && (
            <UserMustConfirm
              s={s} tx={tx} isHindi={isHindi} total={totalVal} host={host}
              hostName={hostName} paymentMethod={paymentMethod} upiId={upiId}
              loading={loading} onUserConfirmPaid={onUserConfirmPaid}
            />
          )}

          {paymentSubState === 'WAITING_FOR_HOST' && (
            <WaitingForOther
              s={s} tx={tx} isHindi={isHindi}
              heading={tx('payment.sentHeading', isHindi ? 'पेमेंट भेज दिया!' : 'Payment sent!')}
              message={tx('payment.waitHost', isHindi ? `${hostName} के कन्फर्म करने का इंतजार...` : `Waiting for ${hostName} to confirm...`)}
              small={tx('payment.usuallyMinute', isHindi ? 'आमतौर पर एक मिनट से कम लगता है' : 'This usually takes less than a minute')}
              person={host} name={hostName} onOpenChat={onOpenChat}
            />
          )}

          {paymentSubState === 'HOST_MUST_CONFIRM' && (
            <HostMustConfirm
              s={s} tx={tx} isHindi={isHindi} total={totalVal} user={user}
              userName={userName} loading={loading}
              onHostConfirmReceived={onHostConfirmReceived} onOpenDispute={onOpenDispute}
            />
          )}

          {paymentSubState === 'WAITING_FOR_USER' && (
            <WaitingForUser s={s} tx={tx} isHindi={isHindi} user={user} userName={userName} />
          )}
        </section>
      </div>

      <div style={s.bottomWrap}>
        <button style={{ ...s.exitLink, ...(loading ? s.disabledBtn : null) }} disabled={loading} onClick={() => onExitForNow?.()}>
          {tx('payment.exitNow', isHindi ? 'अभी के लिए बाहर जाएं' : 'Exit for now')}
        </button>

        {showAutoResolve && (
          <p style={s.autoResolveText}>
            {tx('payment.autoResolves', isHindi ? 'ऑटो-रिज़ॉल्व होगा' : 'Auto-resolves in')} {formatMMSS(autoLeft)}
          </p>
        )}
      </div>
    </div>
  );
}

function UserMustConfirm({ s, tx, isHindi, total, host, hostName, paymentMethod, upiId, loading, onUserConfirmPaid }) {
  return (
    <>
      <h3 style={s.stateHeading}>{tx('payment.complete', isHindi ? 'पेमेंट पूरा करें' : 'Complete your payment')}</h3>
      <p style={s.stateText}>{tx('payment.payCashTo', isHindi ? `₹${total.toFixed(0)} नकद ${hostName} को दें` : `Pay ₹${total.toFixed(0)} cash to ${hostName}`)}</p>

      <PersonCard s={s} person={host} name={hostName} pending={false} />

      <button style={{ ...s.primaryBtn, ...(loading ? s.disabledBtn : null) }} disabled={loading} onClick={() => onUserConfirmPaid?.()}>
        {tx('payment.iPaid', isHindi ? `मैंने ₹${total.toFixed(0)} दे दिए` : `I have paid ₹${total.toFixed(0)}`)}
      </button>

      {paymentMethod === 'UPI' && (
        <div style={s.upiNote}>
          <span>UPI</span>
          <span style={{ color: s.upiNoteTextColor }}>{upiId || 'name@bank'}</span>
        </div>
      )}
    </>
  );
}

function WaitingForOther({ s, tx, isHindi, heading, message, small, person, name, onOpenChat }) {
  return (
    <>
      <h3 style={s.stateHeading}>{heading}</h3>
      <div style={s.spinner} aria-hidden="true" />
      <p style={s.stateText}>{message}</p>
      <PersonCard s={s} person={person} name={name} pending />
      <p style={s.smallMuted}>{small}</p>
      <button style={s.ghostLink} onClick={() => onOpenChat?.()}>{tx('payment.havingTrouble', isHindi ? 'कोई समस्या?' : 'Having trouble?')}</button>
    </>
  );
}

function HostMustConfirm({ s, tx, isHindi, total, user, userName, loading, onHostConfirmReceived, onOpenDispute }) {
  return (
    <>
      <h3 style={s.stateHeading}>{tx('payment.confirmReceived', isHindi ? 'पेमेंट प्राप्ति की पुष्टि करें' : 'Confirm payment received')}</h3>
      <p style={s.stateText}>{tx('payment.didYouReceive', isHindi ? `क्या आपने ${userName} से ₹${total.toFixed(0)} प्राप्त किए?` : `Did you receive ₹${total.toFixed(0)} from ${userName}?`)}</p>

      <PersonCard s={s} person={user} name={userName} pending={false} />

      <button style={{ ...s.primaryBtn, ...(loading ? s.disabledBtn : null) }} disabled={loading} onClick={() => onHostConfirmReceived?.()}>
        {tx('payment.yesReceived', isHindi ? `हाँ, ₹${total.toFixed(0)} मिल गए` : `Yes, I received ₹${total.toFixed(0)}`)}
      </button>

      <button style={{ ...s.dangerGhost, ...(loading ? s.disabledBtn : null) }} disabled={loading} onClick={() => onOpenDispute?.()}>{tx('payment.didNotReceive', isHindi ? 'मुझे पेमेंट नहीं मिला' : 'I did not receive payment')}</button>
    </>
  );
}

function WaitingForUser({ s, tx, isHindi, user, userName }) {
  return (
    <>
      <h3 style={s.stateHeading}>{tx('payment.confirmedHeading', isHindi ? 'कन्फर्म हो गया!' : 'Confirmed!')}</h3>
      <div style={s.greenCheck}>✓</div>
      <p style={s.stateText}>{tx('payment.waitUser', isHindi ? `${userName} के भुगतान कन्फर्मेशन का इंतजार...` : `Waiting for ${userName} to confirm their payment...`)}</p>
      <PersonCard s={s} person={user} name={userName} pending />
    </>
  );
}

function PersonCard({ s, person, name, pending }) {
  return (
    <div style={s.personCard}>
      {person?.avatar
        ? <img src={person.avatar} alt="" style={{ ...s.personAvatar, ...(pending ? s.pendingRing : null) }} referrerPolicy="no-referrer" />
        : <div style={{ ...s.personFallback, ...(pending ? s.pendingRing : null) }}>{initials(name)}</div>}
      <span style={s.personName}>{name}</span>
    </div>
  );
}

function Row({ s, label, value, valueStyle }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={{ ...s.rowValue, ...(valueStyle || null) }}>{value}</span>
    </div>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function formatMMSS(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function makeCssText(c) {
  return `
  * { box-sizing: border-box; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pendingPulse {
    0%,100% { box-shadow: 0 0 0 0 ${c.warningSoft}; }
    50% { box-shadow: 0 0 0 7px transparent; }
  }
  @keyframes checkPop {
    0% { transform: scale(0.4); opacity: 0; }
    70% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
}

function makeStyles(c) {
  return {
    page: { minHeight: '100dvh', background: c.page, color: c.text, fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
    content: { padding: '16px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12 },
    card: { borderRadius: 14, border: `1px solid ${c.border}`, background: c.surface, padding: 12 },
    cardTitle: { margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: c.text },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 },
    rowLabel: { fontSize: 12, color: c.textMuted },
    rowValue: { fontSize: 13, color: c.text, fontWeight: 600 },
    totalRow: { marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 14, fontWeight: 700, color: c.text },
    totalVal: { fontSize: 26, fontWeight: 800, color: c.text },
    stateHeading: { margin: '0 0 6px', fontSize: 22, lineHeight: 1.2, fontWeight: 700, textAlign: 'center', color: c.text },
    stateText: { margin: '0 0 10px', fontSize: 13, lineHeight: 1.4, textAlign: 'center', color: c.textMuted },
    personCard: { borderRadius: 12, border: `1px solid ${c.border}`, background: c.surfaceRaised, padding: 10, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 10 },
    personAvatar: { width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${c.brandPrimary}` },
    personFallback: { width: 46, height: 46, borderRadius: '50%', background: c.brandPrimarySoft, border: `2px solid ${c.brandPrimary}`, color: c.brandPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
    personName: { fontSize: 16, fontWeight: 700, color: c.text },
    pendingRing: { borderColor: c.warning, animation: 'pendingPulse 1.5s ease-in-out infinite' },
    primaryBtn: { width: '100%', borderRadius: 12, border: 'none', background: c.brandPrimary, color: c.page, padding: '12px 14px', fontSize: 15, fontWeight: 700, marginBottom: 8, cursor: 'pointer' },
    dangerGhost: { width: '100%', borderRadius: 12, border: `1px solid ${c.errorSoft}`, background: c.errorSoft, color: c.error, padding: '11px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    disabledBtn: { opacity: 0.55, cursor: 'not-allowed' },
    spinner: { width: 34, height: 34, borderRadius: '50%', border: `3px solid ${c.brandPrimarySoft}`, borderTopColor: c.brandPrimary, margin: '2px auto 10px', animation: 'spin .8s linear infinite' },
    smallMuted: { margin: '0 0 8px', textAlign: 'center', fontSize: 12, color: c.textSoft },
    ghostLink: { width: '100%', border: 'none', background: 'transparent', color: c.textMuted, textDecoration: 'underline', fontSize: 12, cursor: 'pointer' },
    upiNote: { marginTop: 2, borderRadius: 10, border: `1px dashed ${c.borderStrong}`, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: c.textMuted, fontSize: 12 },
    upiNoteTextColor: c.text,
    greenCheck: { width: 58, height: 58, borderRadius: '50%', margin: '2px auto 10px', border: `1px solid ${c.success}`, background: c.successSoft, color: c.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, animation: 'checkPop 480ms cubic-bezier(0.34,1.56,0.64,1) forwards' },
    bottomWrap: { padding: '10px 16px 16px', borderTop: `1px solid ${c.border}`, background: c.surface },
    exitLink: { width: '100%', border: 'none', background: 'transparent', color: c.textMuted, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' },
    autoResolveText: { margin: '8px 0 0', textAlign: 'center', color: c.textSoft, fontSize: 12 },
  };
}
