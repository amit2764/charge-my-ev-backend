import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';

/**
 * Screen 10 — Matching Screen (User, Native)
 *
 * Props:
 *  host: { name, avatar, chargerType, powerKw }
 *  expiresInSeconds?: number (default 58)
 *  onCancelRequest()
 *  onExpire()
 *  onValidateVisibility() // optional hook to let parent re-check routing state
 */
export default function MatchingScreen({
  host = {},
  expiresInSeconds = 58,
  onCancelRequest,
  onExpire,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Number(expiresInSeconds) || 58));

  const [a1] = useState(() => new Animated.Value(0));
  const [a2] = useState(() => new Animated.Value(0));
  const [a3] = useState(() => new Animated.Value(0));

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.();
      return undefined;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, onExpire]);

  useEffect(() => {
    const wave = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const w1 = wave(a1, 0);
    const w2 = wave(a2, 400);
    const w3 = wave(a3, 800);

    w1.start();
    w2.start();
    w3.start();

    return () => {
      w1.stop();
      w2.stop();
      w3.stop();
    };
  }, [a1, a2, a3]);

  const timerText = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = String(secondsLeft % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }, [secondsLeft]);

  const hostName = host?.name || tx('matching.host', 'Host');

  const ringStyle = (val) => ({
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [
      {
        scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }),
      },
    ],
  });

  return (
    <View style={s.page}>
      <View style={s.centerWrap}>
        <View style={s.radarWrap}>
          <Animated.View style={[s.ring, ringStyle(a1)]} />
          <Animated.View style={[s.ring, ringStyle(a2)]} />
          <Animated.View style={[s.ring, ringStyle(a3)]} />
          <View style={s.boltCore}>
            <Text style={s.boltText}>⚡</Text>
          </View>
        </View>

        <Text style={s.heading}>{tx('matching.heading', isHindi ? 'होस्ट ढूंढ रहे हैं...' : 'Finding your host...')}</Text>
        <Text style={s.subtext}>
          {tx('matching.subtextPrefix', isHindi ? 'हमने आपकी रिक्वेस्ट भेज दी है' : "We've sent your request to")}{' '}
          <Text style={s.subtextBold}>{hostName}</Text>
        </Text>

        <Text style={s.timer}>
          {tx('matching.expiresIn', isHindi ? 'समाप्त होगा' : 'Expires in')} <Text style={s.timerVal}>{timerText}</Text>
        </Text>

        <View style={s.hostCard}>
          {host?.avatar
            ? <Image source={{ uri: host.avatar }} style={s.avatar} />
            : <View style={s.avatarFallback}><Text style={s.avatarFallbackText}>{initials(hostName)}</Text></View>}
          <View style={s.hostTextWrap}>
            <Text style={s.hostName} numberOfLines={1}>{hostName}</Text>
            <Text style={s.hostMeta}>{host?.chargerType || 'Type 2'} {host?.powerKw ? `· ${host.powerKw}kW` : ''}</Text>
          </View>
        </View>
      </View>

      <View style={s.bottomWrap}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => onCancelRequest?.()} activeOpacity={0.85}>
          <Text style={s.cancelBtnText}>{tx('matching.cancel', isHindi ? 'रिक्वेस्ट रद्द करें' : 'Cancel Request')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function initials(name = '') {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radarWrap: {
    width: 196,
    height: 196,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(0,212,170,0.62)',
    opacity: 0.6,
  },
  boltCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,212,170,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 7,
  },
  boltText: { color: '#00D4AA', fontSize: 32 },

  heading: {
    marginBottom: 8,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
  },
  subtext: {
    marginBottom: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  subtextBold: { color: '#FFFFFF', fontWeight: '700' },
  timer: {
    marginBottom: 18,
    fontSize: 14,
    color: 'rgba(255,255,255,0.74)',
  },
  timerVal: {
    color: '#00D4AA',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  hostCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(0,212,170,0.4)',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,212,170,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#00D4AA',
    fontWeight: '700',
  },
  hostTextWrap: { flex: 1 },
  hostName: {
    marginBottom: 2,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  hostMeta: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12,
  },

  bottomWrap: { paddingTop: 10 },
  cancelBtn: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,129,0.45)',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#FF6B81',
    fontSize: 14,
    fontWeight: '700',
  },
});
