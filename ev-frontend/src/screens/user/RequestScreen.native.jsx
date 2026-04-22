import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useI18n } from '../../i18n';

const MODES = [
  { id: 'ECO', speed: 'Slow', multiplier: 0.95, eta80: '2h 40m' },
  { id: 'FAST', speed: 'Balanced', multiplier: 1.0, eta80: '1h 35m' },
  { id: 'TURBO', speed: 'High', multiplier: 1.2, eta80: '58m' },
];

/**
 * Screen 09 — Request Screen (User, Native)
 * Props same as web variant.
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
    return { perKwh: Math.round(perKwh * 10) / 10, low, high };
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
    <View style={s.page}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => onBack?.()} activeOpacity={0.8}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tx('request.title', isHindi ? 'चार्ज रिक्वेस्ट' : 'Request Charge')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.contentInner} showsVerticalScrollIndicator={false}>
        <View style={s.hostCard}>
          {host?.avatar
            ? <Image source={{ uri: host.avatar }} style={s.hostAvatar} />
            : <View style={s.hostAvatarFallback}><Text style={s.hostAvatarFallbackText}>{initials(host?.name)}</Text></View>}
          <View style={s.hostInfo}>
            <Text style={s.hostName}>{host?.name || tx('request.host', 'Host')}</Text>
            <Text style={s.hostMeta}>★ {host?.rating ?? 4.7}  ·  {host?.chargerType || charger?.connectorType || 'Type 2'}</Text>
          </View>
        </View>

        <SectionTitle text={tx('request.chargingMode', isHindi ? 'चार्जिंग मोड' : 'Charging Mode')} />
        <View style={s.segmentWrap}>
          {MODES.map((m) => {
            const active = selectedMode === m.id;
            const p = Math.round(basePricePerKwh * m.multiplier * 10) / 10;
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.segment, active && s.segmentActive]}
                onPress={() => setSelectedMode(m.id)}
                activeOpacity={0.85}
              >
                <Text style={[s.segTop, active && s.segTextActive]}>{m.id}</Text>
                <Text style={[s.segMeta, active && s.segMetaActive]}>{m.speed}</Text>
                <Text style={[s.segMeta, active && s.segMetaActive]}>₹{p}/kWh</Text>
                <Text style={[s.segMeta, active && s.segMetaActive]}>{tx('request.eta80', isHindi ? '80% समय' : '80% ETA')}: {m.eta80}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionTitle text={tx('request.estimatedCost', isHindi ? 'अनुमानित लागत' : 'Estimated Cost')} />
        <View style={s.card}>
          <Text style={s.costRange}>{estimate ? `₹${estimate.low} - ₹${estimate.high}` : '₹— - ₹—'}</Text>
          <Text style={s.costHint}>{tx('request.costHint', isHindi ? 'वास्तविक लागत उपयोग पर निर्भर करेगी' : 'Actual amount may vary based on usage')}</Text>
          {appliedPromo && estimate ? (
            <Text style={s.discountText}>{tx('request.discount', isHindi ? 'छूट लागू' : 'Discount applied')}: -₹{discountAmt} ({appliedPromo.code})</Text>
          ) : null}
        </View>

        <SectionTitle text={tx('request.promo', isHindi ? 'प्रोमो कोड' : 'Promo Code')} />
        <View style={s.card}>
          <TouchableOpacity style={s.collapseBtn} onPress={() => setPromoOpen((v) => !v)} activeOpacity={0.8}>
            <Text style={s.collapseText}>{promoOpen ? '−' : '+'}</Text>
            <Text style={s.collapseText}>{promoOpen ? tx('request.hidePromo', isHindi ? 'प्रोमो छुपाएं' : 'Hide promo') : tx('request.addPromo', isHindi ? 'प्रोमो जोड़ें' : 'Add promo')}</Text>
          </TouchableOpacity>

          {promoOpen ? (
            <View style={s.promoRow}>
              <TextInput
                style={s.input}
                value={promoInput}
                onChangeText={(v) => setPromoInput(v.toUpperCase())}
                placeholder={tx('request.enterPromo', isHindi ? 'कोड डालें' : 'Enter code')}
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
              {!appliedPromo ? (
                <TouchableOpacity style={s.applyBtn} onPress={applyPromo} activeOpacity={0.85}>
                  <Text style={s.applyBtnText}>{tx('request.apply', isHindi ? 'लागू करें' : 'Apply')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.removeBtn} onPress={removePromo} activeOpacity={0.85}>
                  <Text style={s.removeBtnText}>{tx('request.remove', isHindi ? 'हटाएं' : 'Remove')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>

        <SectionTitle text={tx('request.paymentMethod', isHindi ? 'पेमेंट तरीका' : 'Payment Method')} />
        <View style={s.card}>
          <View style={s.toggleRow}>
            <TouchableOpacity
              style={[s.toggleBtn, paymentMethod === 'CASH' && s.toggleActive]}
              onPress={() => setPaymentMethod('CASH')}
              activeOpacity={0.85}
            >
              <Text style={[s.toggleText, paymentMethod === 'CASH' && s.toggleTextActive]}>{tx('request.cash', 'Cash')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, paymentMethod === 'UPI' && s.toggleActive]}
              onPress={() => setPaymentMethod('UPI')}
              activeOpacity={0.85}
            >
              <Text style={[s.toggleText, paymentMethod === 'UPI' && s.toggleTextActive]}>UPI</Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'UPI' ? (
            <View style={s.upiWrap}>
              <View style={s.toggleRow}>
                <TouchableOpacity
                  style={[s.smallToggle, upiOption === 'UPI_ID' && s.smallActive]}
                  onPress={() => setUpiOption('UPI_ID')}
                  activeOpacity={0.85}
                >
                  <Text style={[s.smallToggleText, upiOption === 'UPI_ID' && s.smallToggleTextActive]}>UPI ID</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.smallToggle, upiOption === 'QR' && s.smallActive]}
                  onPress={() => setUpiOption('QR')}
                  activeOpacity={0.85}
                >
                  <Text style={[s.smallToggleText, upiOption === 'QR' && s.smallToggleTextActive]}>QR</Text>
                </TouchableOpacity>
              </View>

              {upiOption === 'UPI_ID' ? (
                <TextInput
                  style={s.input}
                  placeholder="name@bank"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={upiInput}
                  onChangeText={setUpiInput}
                  autoCapitalize="none"
                />
              ) : (
                <View style={s.qrBox}><Text style={s.qrText}>QR {tx('request.option', isHindi ? 'विकल्प' : 'Option')}</Text></View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.sendBtn, (!selectedMode || loading) && s.sendBtnDisabled]}
          disabled={!selectedMode || loading}
          onPress={handleSendRequest}
          activeOpacity={0.85}
        >
          <Text style={s.sendBtnText}>
            {loading
              ? tx('request.sending', isHindi ? 'भेजा जा रहा है...' : 'Sending...')
              : tx('request.send', isHindi ? 'रिक्वेस्ट भेजें' : 'Send Request')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionTitle({ text }) {
  return <Text style={s.sectionTitle}>{text}</Text>;
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0A0F' },

  header: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: '#fff', fontSize: 20, marginTop: -1 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },

  content: { flex: 1 },
  contentInner: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 110 },

  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  hostAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(0,212,170,0.4)',
  },
  hostAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,212,170,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarFallbackText: { color: '#00D4AA', fontWeight: '700' },
  hostInfo: { flex: 1 },
  hostName: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 2 },
  hostMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },

  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '700',
  },

  segmentWrap: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 9,
    gap: 3,
  },
  segmentActive: {
    backgroundColor: '#00D4AA',
    borderColor: '#00D4AA',
  },
  segTop: { color: '#fff', fontSize: 13, fontWeight: '700' },
  segTextActive: { color: '#0A0A0F' },
  segMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
  segMetaActive: { color: 'rgba(10,10,15,0.8)' },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  costRange: { color: '#00D4AA', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  costHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  discountText: { marginTop: 8, color: '#22C55E', fontSize: 12, fontWeight: '600' },

  collapseBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseText: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600' },
  promoRow: { marginTop: 10, flexDirection: 'row', gap: 8 },

  input: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(10,10,15,0.65)',
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  applyBtn: {
    borderRadius: 10,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  applyBtnText: { color: '#0A0A0F', fontWeight: '700' },
  removeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  removeBtnText: { color: '#FF7A8E', fontWeight: '600' },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(10,10,15,0.6)',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#00D4AA',
    borderColor: '#00D4AA',
  },
  toggleText: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  toggleTextActive: { color: '#0A0A0F', fontWeight: '700' },

  upiWrap: { marginTop: 10, gap: 8 },
  smallToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(10,10,15,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallActive: {
    backgroundColor: 'rgba(0,212,170,0.2)',
    borderColor: '#00D4AA',
  },
  smallToggleText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  smallToggleTextActive: { color: '#00D4AA', fontWeight: '700' },
  qrBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    paddingVertical: 15,
    alignItems: 'center',
  },
  qrText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: 'rgba(10,10,15,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#00D4AA',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: { color: '#0A0A0F', fontSize: 15, fontWeight: '700' },
});
