import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colorTokens } from '../theme/colors';

const D = colorTokens.dark;

export default function SplashScreen({ onComplete }) {
  const { t, locale } = useI18n();
  const [isExiting, setIsExiting] = useState(false);

  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(0.8));
  const [nameOpacity] = useState(() => new Animated.Value(0));
  const [nameTranslateY] = useState(() => new Animated.Value(8));
  const [taglineOpacity] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [screenOpacity] = useState(() => new Animated.Value(1));

  const appName = t('splash.appName');
  const taglineFromI18n = t('splash.tagline');

  const tagline = useMemo(() => {
    if (taglineFromI18n !== 'splash.tagline') return taglineFromI18n;
    return locale === 'hi' ? 'स्मार्ट चार्जिंग। पावर शेयर करें।' : 'Charge Smarter. Share Power.';
  }, [taglineFromI18n, locale]);

  useEffect(() => {
    Animated.parallel([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), delay: 300, useNativeDriver: true }),
        Animated.timing(nameTranslateY, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), delay: 300, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), delay: 800, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: 1500, delay: 300, easing: Easing.linear, useNativeDriver: false }),
    ]).start();

    const fadeTimer = setTimeout(() => {
      setIsExiting(true);
      Animated.timing(screenOpacity, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }, 1800);

    const doneTimer = setTimeout(() => {
      if (typeof onComplete === 'function') onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [logoOpacity, logoScale, nameOpacity, nameTranslateY, taglineOpacity, progress, screenOpacity, onComplete]);

  return (
    <Animated.View style={[s.container, isExiting && s.exiting, { opacity: screenOpacity }]}>
      <Animated.View style={[s.logoCircle, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Text style={s.logoBolt}>⚡</Text>
      </Animated.View>

      <Animated.Text style={[s.appName, { opacity: nameOpacity, transform: [{ translateY: nameTranslateY }] }]}>{appName}</Animated.Text>
      <Animated.Text style={[s.tagline, { opacity: taglineOpacity }]}>{tagline}</Animated.Text>

      <View style={s.progressTrack}>
        <Animated.View
          style={[
            s.progressFill,
            {
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: D.page,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  exiting: { opacity: 0 },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: D.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: D.brandPrimary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  logoBolt: { fontSize: 40, color: D.brandPrimary },
  appName: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: D.text,
    letterSpacing: -0.6,
  },
  tagline: {
    paddingHorizontal: 24,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: D.textMuted,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: D.brandPrimarySoft,
  },
  progressFill: {
    height: 2,
    backgroundColor: D.brandPrimary,
  },
});
