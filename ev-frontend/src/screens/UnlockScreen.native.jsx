import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../store';

const MAX_ATTEMPTS = 5;

export default function UnlockScreen({ user = {}, onUnlock, onUsePhone, biometricAvailable = false, onBiometric, loading = false }) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const { verifyPin } = useStore();
  const isHindi = locale === 'hi';

  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [bioStatus, setBioStatus] = useState('idle');
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const inputRef = useRef(null);
  const s = makeStyles(c);

  function tx(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
  }

  const lockout = attempts >= MAX_ATTEMPTS;
  const firstName = (user?.displayName ?? '').split(' ')[0] || tx('unlock.user', 'User');

  const triggerBiometric = useCallback(async () => {
    if (!biometricAvailable || !onBiometric || loading) return;
    setBioStatus('prompting');
    try {
      const ok = await onBiometric();
      if (ok) {
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onUnlock?.());
        return;
      }
      setBioStatus('failed');
      inputRef.current?.focus();
    } catch {
      setBioStatus('failed');
      inputRef.current?.focus();
    }
  }, [biometricAvailable, onBiometric, loading, fadeAnim, onUnlock]);

  useEffect(() => {
    const id = setTimeout(() => triggerBiometric(), 0);
    return () => clearTimeout(id);
  }, [triggerBiometric]);

  useEffect(() => {
    const digits = pin.replace(/\D/g, '').slice(0, 4);
    if (digits !== pin) {
      setTimeout(() => setPin(digits), 0);
      return;
    }

    if (digits.length !== 4 || loading || lockout) return;

    setTimeout(async () => {
      const matched = await verifyPin(digits);
      if (matched) {
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onUnlock?.());
        return;
      }

      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      setError(next >= MAX_ATTEMPTS
        ? tx('unlock.lockout', isHindi ? 'बहुत अधिक गलत प्रयास। फ़ोन नंबर से लॉगिन करें।' : 'Too many wrong attempts. Please use phone instead.')
        : tx('unlock.wrongPin', isHindi ? 'गलत PIN, फिर कोशिश करें।' : 'Wrong PIN, try again.'));
      inputRef.current?.focus();
    }, 0);
  }, [pin, loading, lockout, verifyPin, onUnlock, attempts, t, isHindi, fadeAnim]);

  return (
    <Animated.View style={[s.page, { opacity: fadeAnim }]}>
      <View style={s.card}>
        <Text style={s.greeting}>{tx('unlock.greeting', isHindi ? 'वापस आए,' : 'Welcome back,')} <Text style={s.firstName}>{firstName}</Text></Text>

        {!lockout && (
          <>
            <Text style={s.pinLabel}>{tx('unlock.enterPin', isHindi ? 'PIN दर्ज करें' : 'Enter your PIN')}</Text>
            <View style={s.boxRow}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[s.box, i < pin.length && s.boxFilled]} />)}
            </View>

            <TextInput
              ref={inputRef}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              editable={!loading}
              style={s.hiddenInput}
            />

            {biometricAvailable && (
              <Pressable onPress={triggerBiometric} disabled={loading || bioStatus === 'prompting'} style={[s.bioBtn, (loading || bioStatus === 'prompting') && s.disabled]}>
                <Text style={s.bioBtnText}>
                  {bioStatus === 'prompting'
                    ? tx('unlock.scanning', isHindi ? 'स्कैन हो रहा है…' : 'Scanning…')
                    : tx('unlock.useBiometric', isHindi ? 'बायोमेट्रिक से अनलॉक करें' : 'Use Biometric')}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {!!error && <Text style={s.error}>{error}</Text>}

        <Pressable onPress={() => onUsePhone?.()} disabled={loading} style={[s.phoneLink, loading && s.disabled]}>
          <Text style={[s.phoneText, lockout && s.phoneTextLockout]}>
            {tx('unlock.usePhone', isHindi ? 'फ़ोन नंबर से लॉगिन करें' : 'Use phone number instead')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.page, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 20, alignItems: 'center' },
    greeting: { color: c.textMuted, fontSize: 16, textAlign: 'center' },
    firstName: { color: c.text, fontWeight: '700' },
    pinLabel: { marginTop: 16, color: c.textSoft, fontSize: 14 },
    boxRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    box: { width: 52, height: 58, borderRadius: 12, borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceRaised },
    boxFilled: { borderColor: c.brandPrimary, backgroundColor: c.brandPrimarySoft },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    bioBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.brandPrimary, backgroundColor: c.brandPrimarySoft },
    bioBtnText: { color: c.brandPrimary, fontWeight: '600' },
    error: { marginTop: 14, color: c.error, textAlign: 'center' },
    phoneLink: { marginTop: 16 },
    phoneText: { color: c.textSoft, textDecorationLine: 'underline' },
    phoneTextLockout: { color: c.brandPrimary, fontWeight: '600' },
    disabled: { opacity: 0.55 },
  });
}
