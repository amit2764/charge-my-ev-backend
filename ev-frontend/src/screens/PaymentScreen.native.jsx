import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

/**
 * Screen 13 — Payment Screen (Native)
 * Props mirror web variant.
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

  return (
    <View style={s.page}>
      <View style={s.content}>
        <View style={s.card}>
          <Text style={s.cardTitle}>{tx('payment.summary', isHindi ? 'सेशन सारांश' : 'Session Summary')}</Text>

          <Row s={s} label={tx('payment.duration', isHindi ? 'अवधि' : 'Duration')} value={durationVal} />
          <Row s={s} label={tx('payment.kwh', isHindi ? 'डिलीवर kWh' : 'kWh delivered')} value={kwhVal} />
          <Row s={s} label={tx('payment.rate', isHindi ? 'रेट' : 'Rate')} value={rateVal} />
          <Row s={s} label={tx('payment.subtotal', isHindi ? 'उप-योग' : 'Subtotal')} value={`₹${subtotalVal.toFixed(0)}`} />

          {Number(promoDiscount || 0) > 0 && (
            <Row s={s} label={tx('payment.promo', isHindi ? 'प्रोमो छूट' : 'Promo discount')} value={`-₹${Number(promoDiscount).toFixed(0)}`} valueStyle={{ color: c.success }} />
          )}

          <Row s={s} label={tx('payment.platformFee', isHindi ? 'प्लेटफ़ॉर्म शुल्क' : 'Platform fee')} value={`₹${platformFeeVal.toFixed(0)}`} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{tx('payment.total', isHindi ? 'कुल' : 'Total')}</Text>
            <Text style={s.totalVal}>₹{totalVal.toFixed(0)}</Text>
          </View>
        </View>

        <View style={s.card}>
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
        </View>
      </View>

      <View style={s.bottomWrap}>
        <TouchableOpacity onPress={() => onExitForNow?.()} disabled={loading} activeOpacity={0.7}>
          <Text style={[s.exitLink, loading && s.disabled]}>{tx('payment.exitNow', isHindi ? 'अभी के लिए बाहर जाएं' : 'Exit for now')}</Text>
        </TouchableOpacity>

        {showAutoResolve && (
          <Text style={s.autoResolveText}>
            {tx('payment.autoResolves', isHindi ? 'ऑटो-रिज़ॉल्व होगा' : 'Auto-resolves in')} {formatMMSS(autoLeft)}
          </Text>
        )}
      </View>
    </View>
  );
}

function UserMustConfirm({ s, tx, isHindi, total, host, hostName, paymentMethod, upiId, loading, onUserConfirmPaid }) {
  return (
    <>
      <Text style={s.stateHeading}>{tx('payment.complete', isHindi ? 'पेमेंट पूरा करें' : 'Complete your payment')}</Text>
      <Text style={s.stateText}>{tx('payment.payCashTo', isHindi ? `₹${total.toFixed(0)} नकद ${hostName} को दें` : `Pay ₹${total.toFixed(0)} cash to ${hostName}`)}</Text>

      <PersonCard s={s} person={host} name={hostName} pending={false} />

      <TouchableOpacity style={[s.primaryBtn, loading && s.disabled]} onPress={() => onUserConfirmPaid?.()} disabled={loading} activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>{tx('payment.iPaid', isHindi ? `मैंने ₹${total.toFixed(0)} दे दिए` : `I have paid ₹${total.toFixed(0)}`)}</Text>
      </TouchableOpacity>

      {paymentMethod === 'UPI' && (
        <View style={s.upiNote}>
          <Text style={s.upiNoteText}>UPI</Text>
          <Text style={[s.upiNoteText, s.upiNoteTextValue]}>{upiId || 'name@bank'}</Text>
        </View>
      )}
    </>
  );
}

function WaitingForOther({ s, tx, isHindi, heading, message, small, person, name, onOpenChat }) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <>
      <Text style={s.stateHeading}>{heading}</Text>
      <Animated.View style={[s.spinner, { transform: [{ rotate }] }]} />
      <Text style={s.stateText}>{message}</Text>
      <PersonCard s={s} person={person} name={name} pending />
      <Text style={s.smallMuted}>{small}</Text>
      <TouchableOpacity onPress={() => onOpenChat?.()} activeOpacity={0.7}>
        <Text style={s.ghostLink}>{tx('payment.havingTrouble', isHindi ? 'कोई समस्या?' : 'Having trouble?')}</Text>
      </TouchableOpacity>
    </>
  );
}

function HostMustConfirm({ s, tx, isHindi, total, user, userName, loading, onHostConfirmReceived, onOpenDispute }) {
  return (
    <>
      <Text style={s.stateHeading}>{tx('payment.confirmReceived', isHindi ? 'पेमेंट प्राप्ति की पुष्टि करें' : 'Confirm payment received')}</Text>
      <Text style={s.stateText}>{tx('payment.didYouReceive', isHindi ? `क्या आपने ${userName} से ₹${total.toFixed(0)} प्राप्त किए?` : `Did you receive ₹${total.toFixed(0)} from ${userName}?`)}</Text>

      <PersonCard s={s} person={user} name={userName} pending={false} />

      <TouchableOpacity style={[s.primaryBtn, loading && s.disabled]} onPress={() => onHostConfirmReceived?.()} disabled={loading} activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>{tx('payment.yesReceived', isHindi ? `हाँ, ₹${total.toFixed(0)} मिल गए` : `Yes, I received ₹${total.toFixed(0)}`)}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.dangerGhost, loading && s.disabled]} onPress={() => onOpenDispute?.()} disabled={loading} activeOpacity={0.85}>
        <Text style={s.dangerGhostText}>{tx('payment.didNotReceive', isHindi ? 'मुझे पेमेंट नहीं मिला' : 'I did not receive payment')}</Text>
      </TouchableOpacity>
    </>
  );
}

function WaitingForUser({ s, tx, isHindi, user, userName }) {
  const [checkScale] = useState(() => new Animated.Value(0.4));
  const [checkOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [checkScale, checkOpacity]);

  return (
    <>
      <Text style={s.stateHeading}>{tx('payment.confirmedHeading', isHindi ? 'कन्फर्म हो गया!' : 'Confirmed!')}</Text>
      <Animated.View style={[s.greenCheck, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
        <Text style={s.greenCheckText}>✓</Text>
      </Animated.View>
      <Text style={s.stateText}>{tx('payment.waitUser', isHindi ? `${userName} के भुगतान कन्फर्मेशन का इंतजार...` : `Waiting for ${userName} to confirm their payment...`)}</Text>
      <PersonCard s={s} person={user} name={userName} pending />
    </>
  );
}

function PersonCard({ s, person, name, pending }) {
  const { c } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!pending) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pending, pulse]);

  return (
    <View style={s.personCard}>
      {person?.avatar ? (
        <Animated.Image
          source={{ uri: person.avatar }}
          style={[
            s.personAvatar,
            pending && {
              borderColor: c.warning,
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
            },
          ]}
        />
      ) : (
        <Animated.View
          style={[
            s.personFallback,
            pending && {
              borderColor: c.warning,
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
            },
          ]}
        >
          <Text style={s.personFallbackText}>{initials(name)}</Text>
        </Animated.View>
      )}
      <Text style={s.personName}>{name}</Text>
    </View>
  );
}

function Row({ s, label, value, valueStyle }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, valueStyle]}>{value}</Text>
    </View>
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

function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page, justifyContent: 'space-between' },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12 },
    disabled: { opacity: 0.55 },
    card: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12 },
    cardTitle: { marginBottom: 8, fontSize: 15, fontWeight: '700', color: c.text },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 },
    rowLabel: { fontSize: 12, color: c.textMuted },
    rowValue: { fontSize: 13, color: c.text, fontWeight: '600' },
    totalRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 14, fontWeight: '700', color: c.text },
    totalVal: { fontSize: 26, fontWeight: '800', color: c.text },
    stateHeading: { marginBottom: 6, fontSize: 22, lineHeight: 27, fontWeight: '700', textAlign: 'center', color: c.text },
    stateText: { marginBottom: 10, fontSize: 13, lineHeight: 18, textAlign: 'center', color: c.textMuted },
    personCard: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
    personAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: c.brandPrimary },
    personFallback: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.brandPrimarySoft, borderWidth: 2, borderColor: c.brandPrimary, alignItems: 'center', justifyContent: 'center' },
    personFallbackText: { color: c.brandPrimary, fontWeight: '700' },
    personName: { fontSize: 16, fontWeight: '700', color: c.text },
    primaryBtn: { width: '100%', borderRadius: 12, backgroundColor: c.brandPrimary, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    primaryBtnText: { color: c.page, fontSize: 15, fontWeight: '700' },
    dangerGhost: { width: '100%', borderRadius: 12, borderWidth: 1, borderColor: c.error, backgroundColor: c.errorSoft, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
    dangerGhostText: { color: c.error, fontSize: 13, fontWeight: '700' },
    spinner: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: c.brandPrimarySoft, borderTopColor: c.brandPrimary, alignSelf: 'center', marginBottom: 10 },
    smallMuted: { marginBottom: 8, textAlign: 'center', fontSize: 12, color: c.textSoft },
    ghostLink: { textAlign: 'center', color: c.textMuted, textDecorationLine: 'underline', fontSize: 12 },
    upiNote: { marginTop: 2, borderRadius: 10, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    upiNoteText: { color: c.textMuted, fontSize: 12 },
    upiNoteTextValue: { color: c.text, fontSize: 12 },
    greenCheck: { width: 58, height: 58, borderRadius: 29, marginBottom: 10, alignSelf: 'center', borderWidth: 1, borderColor: c.success, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' },
    greenCheckText: { color: c.success, fontSize: 30, fontWeight: '700' },
    bottomWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
    exitLink: { textAlign: 'center', color: c.textMuted, fontSize: 13, textDecorationLine: 'underline' },
    autoResolveText: { marginTop: 8, textAlign: 'center', color: c.textSoft, fontSize: 12 },
  });
}
