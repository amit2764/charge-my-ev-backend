import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

  const [checkScale] = useState(() => new Animated.Value(0.4));
  const [checkOpacity] = useState(() => new Animated.Value(0));

  const resolvedBooking = booking?.id ? booking : (activeBooking || {});
  const resolvedRole = role || activeBookingRole || 'user';
  const s = makeStyles(c);

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [checkScale, checkOpacity]);

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

  function copyText(text, type = 'id') {
    if (!text || loading) return;
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1200);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 1200);
    }
  }

  function handlePinChange(text) {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setUserPin(digits);
    if (digits.length === 4 && onSubmitStartPin) onSubmitStartPin(digits);
  }

  return (
    <View style={s.page}>
      <View style={s.content}>
        <View style={s.successWrap}>
          <Animated.View style={[s.successCheck, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
            <Text style={s.successCheckText}>✓</Text>
          </Animated.View>
        </View>

        <Text style={s.heading}>{tx('confirm.heading', isHindi ? 'बुकिंग कन्फर्म!' : 'Booking Confirmed!')}</Text>

        <View style={s.card}>
          <View style={s.partyRow}>
            {counterparty?.avatar
              ? <Image source={{ uri: counterparty.avatar }} style={s.avatar} />
              : <View style={s.avatarFallback}><Text style={s.avatarFallbackText}>{initials(counterparty?.name || whoLabel)}</Text></View>}
            <View style={s.partyTextWrap}>
              <Text style={s.partyName}>{counterparty?.name || whoLabel}</Text>
              <Text style={s.partyMeta}>{resolvedBooking?.chargerType || 'Type 2'} · {resolvedBooking?.chargingMode || 'FAST'}</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <Text style={s.metaLabel}>{tx('confirm.startTime', isHindi ? 'शुरुआती समय' : 'Estimated start time')}</Text>
            <Text style={s.metaVal}>{startTimeText}</Text>
          </View>

          <View style={s.metaRow}>
            <Text style={s.metaLabel}>{tx('confirm.bookingId', isHindi ? 'बुकिंग ID' : 'Booking ID')}</Text>
            <TouchableOpacity style={[s.copyBtn, loading && s.disabled]} disabled={loading} onPress={() => copyText(fullBookingId, 'id')} activeOpacity={0.8}>
              <Text style={s.metaVal}>{shortBookingId}</Text>
              <Text style={[s.copyText, { color: copiedId ? c.success : c.brandPrimary }]}>{copiedId ? tx('confirm.copied', isHindi ? 'कॉपी' : 'Copied') : tx('confirm.copy', isHindi ? 'कॉपी' : 'Copy')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{tx('confirm.instructions', isHindi ? 'निर्देश' : 'Instructions')}</Text>
          <Text style={s.instructionsText}>
            {resolvedRole === 'user'
              ? tx('confirm.userInstruction', isHindi ? 'चार्जर लोकेशन पर जाएं और तैयार होने पर स्टार्ट PIN दर्ज करें।' : 'Go to the charger location and enter the start PIN when ready.')
              : tx('confirm.hostInstruction', isHindi ? 'यूज़र रास्ते में है। आने पर स्टार्ट PIN साझा करें।' : 'User is on their way. Share the start PIN when they arrive.')}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{tx('confirm.startPin', isHindi ? 'स्टार्ट PIN' : 'Start PIN')}</Text>

          {resolvedRole === 'host' ? (
            <>
              <Text style={s.hostPinDisplay}>{(startPin || '----').split('').join(' ')}</Text>
              <View style={s.hostPinActions}>
                <TouchableOpacity style={[s.ghostBtn, loading && s.disabled]} disabled={loading} onPress={() => copyText(startPin, 'pin')} activeOpacity={0.85}>
                  <Text style={s.ghostBtnText}>{copiedPin ? tx('confirm.copied', isHindi ? 'कॉपी' : 'Copied') : tx('confirm.copyPin', isHindi ? 'PIN कॉपी करें' : 'Copy PIN')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, loading && s.disabled]} disabled={loading} onPress={() => onSharePin?.(startPin)} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>{tx('confirm.sharePin', isHindi ? 'PIN शेयर करें' : 'Share PIN')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={s.pinRow}>
                {[0, 1, 2, 3].map((i) => {
                  const filled = i < userPin.length;
                  return <View key={i} style={[s.pinBox, filled && s.pinBoxFilled]} />;
                })}
              </View>
              <TextInput
                value={userPin}
                onChangeText={handlePinChange}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                editable={!loading}
                style={s.hiddenPinInput}
                autoFocus
              />
              <TouchableOpacity
                style={[s.primaryBtn, { marginTop: 10, opacity: userPin.length === 4 && !loading ? 1 : 0.4 }]}
                disabled={userPin.length !== 4 || loading}
                onPress={() => onSubmitStartPin?.(userPin)}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>{tx('confirm.submitPin', isHindi ? 'PIN सबमिट करें' : 'Submit PIN')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={s.bottomWrap}>
        <TouchableOpacity style={[s.bottomPrimary, loading && s.disabled]} disabled={loading} onPress={() => (resolvedRole === 'user' ? onDirections?.() : onReady?.())} activeOpacity={0.85}>
          <Text style={s.bottomPrimaryText}>
            {resolvedRole === 'user'
              ? tx('confirm.getDirections', isHindi ? 'दिशा देखें' : 'Get Directions')
              : tx('confirm.imReady', isHindi ? 'मैं तैयार हूं' : "I'm Ready")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page, justifyContent: 'space-between' },
    content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12, gap: 12 },
    disabled: { opacity: 0.6 },
    successWrap: {
      width: 92,
      height: 92,
      marginBottom: 4,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    successCheck: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.successSoft,
      borderWidth: 1,
      borderColor: c.success,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.success,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    successCheckText: { color: c.success, fontSize: 34, fontWeight: '700' },
    heading: { textAlign: 'center', fontSize: 26, lineHeight: 31, fontWeight: '700', color: c.text },
    card: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12 },
    sectionTitle: { marginBottom: 8, fontSize: 14, color: c.text, fontWeight: '700' },
    partyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.brandPrimary },
    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.brandPrimarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: { color: c.brandPrimary, fontWeight: '700' },
    partyTextWrap: { flex: 1 },
    partyName: { marginBottom: 2, fontSize: 15, fontWeight: '700', color: c.text },
    partyMeta: { fontSize: 12, color: c.textMuted },
    metaRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    metaLabel: { fontSize: 12, color: c.textSoft },
    metaVal: { fontSize: 13, color: c.text, fontWeight: '600' },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    copyText: { fontSize: 12, fontWeight: '700' },
    instructionsText: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    hostPinDisplay: {
      fontSize: 38,
      letterSpacing: 6,
      textAlign: 'center',
      color: c.brandPrimary,
      fontWeight: '800',
      marginTop: 4,
      marginBottom: 12,
    },
    hostPinActions: { flexDirection: 'row', gap: 8 },
    pinRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
    pinBox: {
      width: 56,
      height: 62,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinBoxFilled: { borderColor: c.brandPrimary, backgroundColor: c.brandPrimarySoft },
    hiddenPinInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    ghostBtn: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      backgroundColor: c.surfaceRaised,
    },
    ghostBtnText: { color: c.text, fontWeight: '600' },
    primaryBtn: {
      flex: 1.2,
      borderRadius: 10,
      backgroundColor: c.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    primaryBtnText: { color: c.page, fontWeight: '700' },
    bottomWrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    bottomPrimary: {
      width: '100%',
      borderRadius: 12,
      backgroundColor: c.brandPrimary,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomPrimaryText: { color: c.page, fontSize: 15, fontWeight: '700' },
  });
}
