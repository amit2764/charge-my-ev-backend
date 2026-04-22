import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function LoginScreen({ onSendOtp, loading = false }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const [phone, setPhone] = useState('');
  const [cardTranslateY] = useState(() => new Animated.Value(42));
  const [cardOpacity] = useState(() => new Animated.Value(0));

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardTranslateY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [cardTranslateY, cardOpacity]);

  const heading = tx('auth.welcome', locale === 'hi' ? 'वापस स्वागत है' : 'Welcome back');
  const canSubmit = phone.length === 10 && !loading;
  const s = makeStyles(c);

  return (
    <View style={s.page}>
      <View style={s.topIllustration}>
        <View style={s.orbA} />
        <View style={s.orbB} />
      </View>

      <View style={s.bottomWrap}>
        <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
          <Text style={s.heading}>{heading}</Text>

          <View style={s.fieldWrap}>
            <Text style={s.label}>{tx('auth.phone', 'Mobile Number')}</Text>
            <View style={s.phoneRow}>
              <View style={s.prefixBox}><Text style={s.prefix}>+91</Text></View>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                editable={!loading}
                placeholder={tx('auth.phonePlaceholder', 'Enter your 10-digit number')}
                placeholderTextColor={c.textSoft}
                style={s.phoneInput}
              />
            </View>
          </View>

          <Pressable onPress={() => canSubmit && onSendOtp?.(phone)} disabled={!canSubmit} style={[s.primaryBtn, !canSubmit && s.disabled]}>
            <Text style={s.primaryBtnText}>{loading ? tx('auth.verifying', 'Verifying...') : tx('auth.sendOtp', 'Send OTP')}</Text>
          </Pressable>

          <Text style={s.termsText}>
            {tx('auth.agreeTo', 'By continuing you agree to our')} <Text style={s.linkText}>{tx('auth.terms', 'Terms')}</Text> & <Text style={s.linkText}>{tx('auth.privacy', 'Privacy Policy')}</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page },
    disabled: { opacity: 0.55 },
    topIllustration: { flex: 0.4, minHeight: 220, backgroundColor: c.brandPrimary, position: 'relative', overflow: 'hidden' },
    orbA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: c.brandPrimarySoft, top: -70, right: -30 },
    orbB: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: c.infoSoft, bottom: -40, left: -30 },
    bottomWrap: { flex: 0.6, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
    card: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: 20,
      paddingVertical: 24,
      gap: 16,
    },
    heading: { fontSize: 32, lineHeight: 38, color: c.text, fontWeight: '700', letterSpacing: -0.6 },
    fieldWrap: { gap: 8 },
    label: { fontSize: 13, color: c.textMuted },
    phoneRow: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden', flexDirection: 'row', backgroundColor: c.page },
    prefixBox: { width: 72, borderRightWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    prefix: { fontSize: 14, fontWeight: '600', color: c.text },
    phoneInput: { flex: 1, color: c.text, fontSize: 15, paddingHorizontal: 14 },
    primaryBtn: { minHeight: 52, borderRadius: 9999, backgroundColor: c.brandPrimary, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: c.page, fontSize: 15, fontWeight: '700' },
    termsText: { fontSize: 12, lineHeight: 18, color: c.textSoft },
    linkText: { color: c.brandPrimary, fontWeight: '600' },
  });
}
