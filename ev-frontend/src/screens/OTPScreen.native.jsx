import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function OTPScreen({ phone = '', verifying = false, onBack, onVerifyOtp, onResendOtp, onChangeNumber }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [pulse] = useState(() => new Animated.Value(0.2));
  const refs = useRef([]);
  const s = makeStyles(c);

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  useEffect(() => {
    if (!verifying) {
      pulse.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.2, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [verifying, pulse]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const phoneMasked = useMemo(() => {
    const digits = String(phone).replace(/\D/g, '').slice(-10);
    if (!digits) return '+91 XXXXX XXXXX';
    return `+91 XXXXX ${digits.slice(-5)}`;
  }, [phone]);

  function handleChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const arr = otp.padEnd(6, ' ').split('');
    arr[index] = digit || ' ';
    const next = arr.join('').replace(/\s+$/g, '');
    setOtp(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
    if (next.length === 6 && !verifying) onVerifyOtp?.(next);
  }

  function onResend() {
    if (secondsLeft > 0 || verifying) return;
    setSecondsLeft(45);
    setOtp('');
    refs.current[0]?.focus();
    onResendOtp?.();
  }

  return (
    <View style={s.page}>
      <View style={s.topRow}>
        <Pressable onPress={() => onBack?.()} disabled={verifying} style={[s.backBtn, verifying && s.disabled]}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
      </View>

      <View style={s.content}>
        <Text style={s.heading}>{tx('auth.enterOtp', locale === 'hi' ? 'OTP दर्ज करें' : 'Enter OTP')}</Text>
        <Text style={s.subText}>{tx('auth.otpSent', 'Sent to')} {phoneMasked}</Text>

        <View style={s.otpRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Animated.View key={i} style={[s.otpBoxWrap, verifying && { opacity: pulse }]}>
              <TextInput
                ref={(el) => (refs.current[i] = el)}
                value={otp[i] || ''}
                onChangeText={(v) => handleChange(i, v)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!verifying}
                style={[s.otpBox, verifying && s.otpBoxVerifying]}
              />
            </Animated.View>
          ))}
        </View>

        <View style={s.resendWrap}>
          {secondsLeft > 0 ? (
            <Text style={s.resendTimer}>{tx('auth.resendIn', 'Resend in')} 0:{String(secondsLeft).padStart(2, '0')}</Text>
          ) : (
            <Pressable onPress={onResend} disabled={verifying} style={verifying && s.disabled}>
              <Text style={s.linkText}>{tx('auth.resend', 'Resend OTP')}</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => onChangeNumber?.()} disabled={verifying} style={verifying && s.disabled}>
          <Text style={s.changeNumber}>{tx('auth.changeNumber', 'Change number')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page, paddingHorizontal: 20, paddingTop: 20 },
    disabled: { opacity: 0.55 },
    topRow: { height: 48, justifyContent: 'center' },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { fontSize: 20, color: c.text, marginTop: -2 },
    content: { marginTop: 28, alignItems: 'center', gap: 10 },
    heading: { fontSize: 32, lineHeight: 38, fontWeight: '700', color: c.text, letterSpacing: -0.6 },
    subText: { fontSize: 14, color: c.textMuted, textAlign: 'center' },
    otpRow: { marginTop: 18, flexDirection: 'row', gap: 8, justifyContent: 'center' },
    otpBoxWrap: { borderRadius: 12 },
    otpBox: {
      width: 46,
      height: 56,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      textAlign: 'center',
      fontSize: 24,
    },
    otpBoxVerifying: { borderColor: c.brandPrimary },
    resendWrap: { marginTop: 16, minHeight: 24, justifyContent: 'center' },
    resendTimer: { fontSize: 14, color: c.textMuted },
    linkText: { fontSize: 14, color: c.brandPrimary, fontWeight: '600' },
    changeNumber: { marginTop: 6, fontSize: 14, color: c.textSoft, textDecorationLine: 'underline' },
  });
}
