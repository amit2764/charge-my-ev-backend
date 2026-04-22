import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [dotPulse] = useState(() => new Animated.Value(1));

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetCost(Number(session?.kwhDelivered || 0) * Number(session?.ratePerKwh || 22));
  }, [session?.kwhDelivered, session?.powerKw, session?.ratePerKwh]);

  useEffect(() => {
    const d = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    d.start();
    return () => d.stop();
  }, [dotPulse]);

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

  function confirmStop() {
    if (stopPin.length !== 4 || loading) return;
    onStopCharging?.(stopPin);
    setStopOpen(false);
    setStopPin('');
  }

  return (
    <View style={s.page}>
      <View style={s.content}>
        <View style={s.header}>
          <View style={s.statusRow}>
            <Animated.View style={[s.statusDot, { opacity: dotPulse, transform: [{ scale: dotPulse }] }]} />
            <Text style={s.statusText}>{tx('charging.active', isHindi ? 'सेशन चालू' : 'Session Active')}</Text>
          </View>
          <Text style={s.timer}>{hhmmss}</Text>
        </View>

        <View style={s.mainCard}>
          <Text style={s.bigValue}>{displayKwh.toFixed(2)}</Text>
          <Text style={s.bigLabel}>kWh {tx('charging.delivered', isHindi ? 'डिलीवर' : 'delivered')}</Text>
          <View style={s.midStatsRow}>
            <View style={s.midStat}><Text style={s.midVal}>{displayPower.toFixed(1)}</Text><Text style={s.midLbl}>kW</Text></View>
            <View style={s.midStat}><Text style={s.midVal}>₹{displayCost.toFixed(0)}</Text><Text style={s.midLbl}>{tx('charging.costSoFar', isHindi ? 'अब तक' : 'cost so far')}</Text></View>
          </View>
        </View>

        <View style={s.batteryWrap}>
          <View style={s.batteryBody}><View style={[s.batteryFill, { height: `${fillPct}%` }]} /><Text style={s.bolt}>⚡</Text></View>
          <View style={s.batteryCap} />
          <Text style={s.fillPct}>{Math.round(fillPct)}%</Text>
        </View>

        <View style={s.detailsRow}>
          <MiniCard s={s} label={tx('charging.mode', isHindi ? 'मोड' : 'Mode')} value={mode} />
          <MiniCard s={s} label={tx('charging.rate', isHindi ? 'रेट' : 'Rate')} value={`₹${ratePerKwh}/kWh`} />
          <MiniCard s={s} label={tx('charging.remaining', isHindi ? 'बाकी' : 'Est. remaining')} value={remaining} />
        </View>
      </View>

      <TouchableOpacity style={[s.chatFab, loading && s.disabled]} disabled={loading} onPress={() => onOpenChat?.()} activeOpacity={0.85}>
        <Text style={s.chatFabText}>💬</Text>
        {unreadCount > 0 ? <View style={s.chatBadge}><Text style={s.chatBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
      </TouchableOpacity>

      <View style={s.bottomWrap}>
        <TouchableOpacity style={[s.stopBtn, loading && s.disabled]} disabled={loading} onPress={() => setStopOpen(true)} activeOpacity={0.85}>
          <Text style={s.stopBtnText}>{tx('charging.stop', isHindi ? 'चार्जिंग रोकें' : 'Stop Charging')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={loading && s.disabled} disabled={loading} onPress={() => onEmergencyStop?.()} activeOpacity={0.7}>
          <Text style={s.emergencyLink}>{tx('charging.emergency', isHindi ? 'इमरजेंसी स्टॉप — होस्ट ऑफलाइन?' : 'Emergency stop — host offline?')}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={stopOpen} transparent animationType="fade" onRequestClose={() => setStopOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{tx('charging.confirmStop', isHindi ? 'क्या आप सुनिश्चित हैं?' : 'Are you sure?')}</Text>
            <Text style={s.modalText}>{tx('charging.enterStopPin', isHindi ? 'सेशन खत्म करने के लिए स्टॉप PIN दर्ज करें' : 'Enter stop PIN to end session')}</Text>
            <View style={s.pinRow}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[s.pinBox, i < stopPin.length && s.pinBoxFilled]} />)}
            </View>
            <TextInput value={stopPin} onChangeText={(v) => setStopPin(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} secureTextEntry autoFocus style={s.hiddenPinInput} />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalGhost} onPress={() => setStopOpen(false)} activeOpacity={0.85}><Text style={s.modalGhostText}>{tx('common.cancel', isHindi ? 'रद्द करें' : 'Cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.modalDanger, { opacity: stopPin.length === 4 ? 1 : 0.4 }]} onPress={confirmStop} disabled={stopPin.length !== 4} activeOpacity={0.85}><Text style={s.modalDangerText}>{tx('charging.endSession', isHindi ? 'सेशन खत्म करें' : 'End Session')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MiniCard({ s, label, value }) {
  return (
    <View style={s.miniCard}>
      <Text style={s.miniVal}>{value}</Text>
      <Text style={s.miniLbl}>{label}</Text>
    </View>
  );
}

function useAnimatedNumber(target, duration = 600) {
  const [value, setValue] = useState(Number(target) || 0);
  const animRef = useRef(new Animated.Value(Number(target) || 0));

  useEffect(() => {
    const to = Number(target) || 0;
    const listener = animRef.current.addListener(({ value: v }) => setValue(v));
    Animated.timing(animRef.current, { toValue: to, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => animRef.current.removeListener(listener);
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
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page },
    content: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 130 },
    disabled: { opacity: 0.6 },
    header: { marginBottom: 14 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
    statusText: { fontSize: 13, color: c.success, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    timer: { fontSize: 38, fontWeight: '800', letterSpacing: 1.2, color: c.text },
    mainCard: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, marginBottom: 16 },
    bigValue: { fontSize: 44, lineHeight: 46, fontWeight: '800', color: c.brandPrimary },
    bigLabel: { marginTop: 4, fontSize: 13, color: c.textMuted },
    midStatsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    midStat: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, padding: 10 },
    midVal: { fontSize: 22, fontWeight: '700', color: c.text },
    midLbl: { marginTop: 2, fontSize: 11, color: c.textSoft },
    batteryWrap: { marginBottom: 16, alignItems: 'center' },
    batteryBody: { width: 118, height: 178, borderRadius: 14, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surfaceRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    batteryFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.brandPrimary },
    bolt: { color: c.surfaceInverse, fontSize: 34, fontWeight: '700' },
    batteryCap: { width: 42, height: 8, borderRadius: 4, backgroundColor: c.borderStrong, marginTop: 6 },
    fillPct: { marginTop: 8, color: c.brandPrimary, fontWeight: '700', fontSize: 14 },
    detailsRow: { flexDirection: 'row', gap: 8 },
    miniCard: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
    miniVal: { color: c.text, fontWeight: '700', fontSize: 13 },
    miniLbl: { marginTop: 2, color: c.textSoft, fontSize: 10, textAlign: 'center' },
    chatFab: { position: 'absolute', right: 16, bottom: 132, width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: c.brandPrimary, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    chatFabText: { color: c.brandPrimary, fontSize: 24 },
    chatBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.error, borderWidth: 1.5, borderColor: c.page, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    chatBadgeText: { color: c.surfaceInverse, fontSize: 10, fontWeight: '700' },
    bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
    stopBtn: { width: '100%', borderRadius: 12, borderWidth: 1, borderColor: c.error, backgroundColor: c.errorSoft, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    stopBtnText: { color: c.error, fontSize: 15, fontWeight: '700' },
    emergencyLink: { marginTop: 8, color: c.textMuted, fontSize: 12, textAlign: 'center', textDecorationLine: 'underline' },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { width: '100%', maxWidth: 380, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, padding: 14 },
    modalTitle: { marginBottom: 6, fontSize: 18, color: c.text, fontWeight: '700' },
    modalText: { marginBottom: 12, color: c.textMuted, fontSize: 13, lineHeight: 18 },
    pinRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 12 },
    pinBox: { width: 54, height: 58, borderRadius: 12, borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    pinBoxFilled: { borderColor: c.brandPrimary, backgroundColor: c.brandPrimarySoft },
    hiddenPinInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    modalActions: { flexDirection: 'row', gap: 8 },
    modalGhost: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    modalGhostText: { color: c.text, fontWeight: '600' },
    modalDanger: { flex: 1, borderRadius: 10, backgroundColor: c.error, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    modalDangerText: { color: c.page, fontWeight: '700' },
  });
}
