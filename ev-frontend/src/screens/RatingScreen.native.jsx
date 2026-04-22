import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

/**
 * Screen 14 — Rating Screen (Native)
 *
 * Props:
 *  role: 'user' | 'host'
 *  party: { name, avatar }
 *  summary: { kwh, duration, amount }
 *  onSubmitRating({ rating, comment })
 *  onSkip()
 *  onValidateVisibility()
 */
export default function RatingScreen({
  role = 'user',
  party = {},
  summary = {},
  loading = false,
  onSubmitRating,
  onSkip,
  onValidateVisibility,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  const pop = useMemo(() => new Animated.Value(0.5), []);
  const confetti = useMemo(() => [...Array(18)].map(() => new Animated.Value(0)), []);

  useEffect(() => {
    onValidateVisibility?.();
  }, [onValidateVisibility]);

  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();

    confetti.forEach((v, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay((i % 6) * 70),
          Animated.timing(v, {
            toValue: 1,
            duration: 950,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });
  }, [pop, confetti]);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const maxChars = 200;
  const otherLabel = role === 'user'
    ? tx('rating.yourHost', isHindi ? 'आपके होस्ट' : 'Your Host')
    : tx('rating.yourUser', isHindi ? 'आपके यूज़र' : 'Your User');

  const kwh = typeof summary?.kwh === 'number' ? `${summary.kwh.toFixed(2)} kWh` : (summary?.kwh || '—');
  const duration = summary?.duration || '—';
  const amount = summary?.amount != null ? `₹${Number(summary.amount).toFixed(0)}` : '—';
  const summaryRows = [
    { label: tx('rating.totalKwh', isHindi ? 'कुल kWh' : 'Total kWh'), value: kwh },
    { label: tx('rating.duration', isHindi ? 'अवधि' : 'Duration'), value: duration },
    { label: tx('rating.amountPaid', isHindi ? 'भुगतान राशि' : 'Amount paid'), value: amount },
  ];

  const styles = makeStyles(c);
  const confettiColors = [c.brandPrimary, c.success, c.brandPrimary, c.success];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.celeWrap}>
          {confetti.map((v, i) => {
            const angle = (i / 18) * Math.PI * 2;
            const x = Math.cos(angle) * (40 + (i % 4) * 6);
            const y = Math.sin(angle) * (40 + (i % 5) * 5);
            return (
              <Animated.View
                key={String(i)}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: confettiColors[i % confettiColors.length],
                    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
                      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) },
                      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                    ],
                  },
                ]}
              />
            );
          })}

          <Animated.View style={[styles.celeCore, { transform: [{ scale: pop }] }]}>
            <Text style={styles.celeEmoji}>🎉</Text>
          </Animated.View>
        </View>

        <Text style={styles.heading}>{tx('rating.complete', isHindi ? 'सेशन पूरा!' : 'Session Complete!')}</Text>
        <Text style={styles.subtext}>{tx('rating.rateExperience', isHindi ? 'अपना अनुभव रेट करें' : 'Rate your experience')}</Text>

        <View style={styles.partyWrap}>
          {party?.avatar
            ? <Image source={{ uri: party.avatar }} style={styles.avatar} />
            : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials(party?.name || otherLabel)}</Text>
              </View>
            )}
          <Text style={styles.partyName}>{party?.name || otherLabel}</Text>
          <Text style={styles.partyMeta}>{otherLabel}</Text>
        </View>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= rating;
            return (
              <Pressable
                key={String(n)}
                style={({ pressed }) => [styles.starBtn, { transform: [{ scale: active ? 1.14 : pressed ? 0.96 : 1 }] }]}
                onPress={() => setRating(n)}
              >
                <Text style={[styles.star, active && styles.starActive]}>★</Text>
              </Pressable>
            );
          })}
        </View>

        {rating > 0 && (
          <View style={styles.commentWrap}>
            <TextInput
              value={comment}
              onChangeText={(v) => setComment((v || '').slice(0, maxChars))}
              style={styles.commentInput}
              placeholder={tx('rating.commentPlaceholder', isHindi ? 'टिप्पणी जोड़ें...' : 'Add a comment...')}
              placeholderTextColor={c.textSoft}
              multiline
              textAlignVertical="top"
              maxLength={maxChars}
            />
            <Text style={styles.counter}>{comment.length}/{maxChars}</Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryBtn, (rating && !loading) ? null : styles.primaryBtnDisabled]}
          disabled={!rating || loading}
          onPress={() => onSubmitRating?.({ rating, comment: comment.trim() })}
        >
          <Text style={styles.primaryBtnText}>{tx('rating.submit', isHindi ? 'रेटिंग सबमिट करें' : 'Submit Rating')}</Text>
        </Pressable>

        <Pressable style={styles.ghostBtn} disabled={loading} onPress={() => onSkip?.()}>
          <Text style={styles.ghostBtnText}>{tx('rating.skip', isHindi ? 'स्किप' : 'Skip')}</Text>
        </Pressable>

        <View style={styles.summaryCard}>
          <Pressable style={styles.summaryHeader} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.summaryTitle}>{tx('rating.sessionSummary', isHindi ? 'सेशन सारांश' : 'Session Summary')}</Text>
            <Text style={[styles.chevron, expanded && styles.chevronUp]}>⌄</Text>
          </Pressable>

          {expanded && (
            <View style={styles.summaryBody}>
              {summaryRows.map((r) => (
                <View style={styles.summaryRow} key={r.label}>
                  <Text style={styles.summaryLabel}>{r.label}</Text>
                  <Text style={styles.summaryVal}>{r.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.page },
    content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 26 },
    celeWrap: { width: 112, height: 112, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 8 },
    confetti: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },
    celeCore: { width: 62, height: 62, borderRadius: 31, backgroundColor: c.brandPrimarySoft, borderWidth: 1, borderColor: c.brandPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: c.brandPrimary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4 },
    celeEmoji: { fontSize: 30 },
    heading: { color: c.text, fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
    subtext: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 14 },
    partyWrap: { alignItems: 'center', marginBottom: 12 },
    avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: c.brandPrimary, marginBottom: 8 },
    avatarFallback: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.brandPrimarySoft, borderWidth: 2, borderColor: c.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    avatarInitials: { color: c.brandPrimary, fontSize: 24, fontWeight: '700' },
    partyName: { color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 2 },
    partyMeta: { color: c.textMuted, fontSize: 12 },
    starsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    starBtn: { paddingHorizontal: 4, paddingVertical: 2 },
    star: { fontSize: 42, lineHeight: 42, color: c.textSoft },
    starActive: { color: c.brandPrimary },
    commentWrap: { marginBottom: 12 },
    commentInput: { minHeight: 88, maxHeight: 130, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, color: c.text, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13 },
    counter: { color: c.textSoft, fontSize: 11, textAlign: 'right', marginTop: 6, marginHorizontal: 2 },
    primaryBtn: { backgroundColor: c.brandPrimary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 47, marginBottom: 8 },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { color: c.page, fontSize: 15, fontWeight: '700' },
    ghostBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 34, marginBottom: 12 },
    ghostBtnText: { color: c.textMuted, fontSize: 13, textDecorationLine: 'underline' },
    summaryCard: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
    summaryHeader: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    chevron: { color: c.text, fontSize: 16 },
    chevronUp: { transform: [{ rotate: '180deg' }] },
    summaryBody: { paddingHorizontal: 12, paddingBottom: 10 },
    summaryRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { color: c.textMuted, fontSize: 12 },
    summaryVal: { color: c.text, fontSize: 13, fontWeight: '700' },
  });
}
