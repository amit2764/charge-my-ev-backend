import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store';

export default function PINSetupScreen({ onComplete, loading = false }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const { setPin: savePin } = useStore();
  const isHindi = locale === 'hi';

  const [step, setStep] = useState('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shakeX] = useState(() => new Animated.Value(0));
  const enterRef = useRef(null);
  const confirmRef = useRef(null);
  const s = makeStyles(c);

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  useEffect(() => {
    if (step === 'enter' && pin.length === 4) {
      const id = setTimeout(() => {
        setStep('confirm');
        confirmRef.current?.focus();
      }, 250);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [step, pin]);

  useEffect(() => {
    if (step !== 'confirm' || confirmPin.length !== 4 || loading) return;

    if (confirmPin === pin) {
      setTimeout(async () => {
        await savePin(pin);
        onComplete?.(pin);
      }, 0);
      return;
    }

    Animated.sequence([
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    setTimeout(() => setError(isHindi ? 'PINs मेल नहीं खाते, फिर कोशिश करें' : "PINs don't match, try again"), 0);
    const id = setTimeout(() => {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setError('');
      enterRef.current?.focus();
    }, 650);

    return () => clearTimeout(id);
  }, [confirmPin, pin, step, loading, savePin, onComplete, isHindi, shakeX]);

  const current = step === 'enter' ? pin : confirmPin;
  const setCurrent = step === 'enter' ? setPin : setConfirmPin;

  return (
    <View style={s.page}>
      <View style={s.card}>
        <Text style={s.heading}>
          {step === 'confirm'
            ? tx('pin.confirmHeading', isHindi ? 'PIN की पुष्टि करें' : 'Confirm your PIN')
            : tx('pin.setHeading', isHindi ? 'अपना सुरक्षित PIN सेट करें' : 'Set your secure PIN')}
        </Text>

        <Text style={s.subtext}>
          {step === 'confirm'
            ? tx('pin.confirmSubtext', isHindi ? 'PIN दोबारा दर्ज करें' : 'Re-enter your PIN to confirm')
            : tx('pin.setSubtext', isHindi ? 'ऐप को जल्दी अनलॉक करने के लिए उपयोग किया जाएगा' : 'Used to unlock the app quickly')}
        </Text>

        <Animated.View style={[s.boxRow, { transform: [{ translateX: shakeX }] }]}>
          {[0, 1, 2, 3].map((i) => {
            const filled = i < current.length;
            return <View key={i} style={[s.box, filled && s.boxFilled]} />;
          })}
        </Animated.View>

        <TextInput
          ref={step === 'enter' ? enterRef : confirmRef}
          value={current}
          onChangeText={(v) => setCurrent(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          autoFocus
          editable={!loading}
          style={s.hiddenInput}
        />

        <Text style={[s.status, error ? s.error : s.hint]}>
          {error || tx('pin.hint', isHindi ? '4 अंकों का PIN दर्ज करें' : 'Enter a 4-digit PIN')}
        </Text>

        {loading && <Text style={s.loading}>{tx('pin.saving', isHindi ? 'PIN सेव हो रहा है...' : 'Saving PIN...')}</Text>}

        <Pressable onPress={() => (step === 'enter' ? setPin('') : setConfirmPin(''))} disabled={loading} style={[s.clearBtn, loading && s.disabled]}>
          <Text style={s.clearBtnText}>{tx('common.edit', 'Edit')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 20 },
    heading: { fontSize: 24, fontWeight: '700', color: c.text, textAlign: 'center' },
    subtext: { marginTop: 8, fontSize: 14, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
    boxRow: { marginTop: 22, flexDirection: 'row', justifyContent: 'center', gap: 12 },
    box: { width: 52, height: 58, borderRadius: 12, borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceRaised },
    boxFilled: { borderColor: c.brandPrimary, backgroundColor: c.brandPrimarySoft },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    status: { marginTop: 16, textAlign: 'center', minHeight: 20 },
    hint: { color: c.textSoft },
    error: { color: c.error, fontWeight: '500' },
    loading: { marginTop: 8, color: c.textMuted, textAlign: 'center' },
    clearBtn: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: c.surfaceRaised },
    clearBtnText: { color: c.textMuted, fontWeight: '600' },
    disabled: { opacity: 0.55 },
  });
}
