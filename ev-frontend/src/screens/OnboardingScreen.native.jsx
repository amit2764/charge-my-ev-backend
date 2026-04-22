import React, { useState } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function OnboardingScreen({ isFirstInstall = true, onComplete }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panX] = useState(() => new Animated.Value(0));
  const windowWidth = Dimensions.get('window').width;

  function tx(key, fallback) {
    const val = t(key);
    return val === key ? fallback : val;
  }

  const slides = [
    { key: 'find-charger', title: tx('onboarding.slide1.title', 'Find a Charger Near You'), subtitle: tx('onboarding.slide1.subtitle', 'पास में चार्जर खोजें'), glyph: '📍' },
    { key: 'share-earn', title: tx('onboarding.slide2.title', 'Share Your Charger, Earn Money'), subtitle: tx('onboarding.slide2.subtitle', 'अपना चार्जर शेयर करें, पैसे कमाएं'), glyph: '₹' },
    { key: 'safe-fast-cashless', title: tx('onboarding.slide3.title', 'Safe, Fast, Cashless'), subtitle: tx('onboarding.slide3.subtitle', 'सुरक्षित, तेज़, कैशलेस'), glyph: '⚡' },
  ];

  const isLast = activeIndex === slides.length - 1;
  const activeSlide = slides[activeIndex];
  const s = makeStyles(c);

  if (!isFirstInstall) return null;

  function finish() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => onComplete?.(), 0);
  }

  function goNext() {
    if (isSubmitting) return;
    if (isLast) {
      finish();
      return;
    }
    setActiveIndex((v) => Math.min(v + 1, slides.length - 1));
  }

  function goPrev() {
    if (isSubmitting) return;
    setActiveIndex((v) => Math.max(v - 1, 0));
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      if (isSubmitting) return;
      panX.setValue(g.dx);
      setDragDx(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      if (!isSubmitting) {
        if (g.dx < -52) goNext();
        else if (g.dx > 52) goPrev();
      }
      Animated.spring(panX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 90 }).start();
      setDragDx(0);
    },
    onPanResponderTerminate: () => {
      Animated.spring(panX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 90 }).start();
      setDragDx(0);
    },
  });

  const translateBase = -activeIndex * windowWidth;
  const logicalIndex = activeIndex - dragDx / windowWidth;

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <View />
        <Pressable onPress={finish} disabled={isSubmitting} style={[s.skipGhostBtn, isSubmitting && s.disabled]}>
          <Text style={s.skipText}>{tx('onboarding.skip', 'Skip')}</Text>
        </Pressable>
      </View>

      <View style={s.topIllustrationWrap} {...panResponder.panHandlers}>
        <Animated.View style={{ flexDirection: 'row', width: windowWidth * slides.length, transform: [{ translateX: Animated.add(new Animated.Value(translateBase), panX) }] }}>
          {slides.map((slide, idx) => {
            const distance = Math.abs(idx - logicalIndex);
            const opacity = Math.max(0.45, 1 - distance * 0.55);
            const parallax = idx === activeIndex ? dragDx * 0.7 : 0;
            return (
              <Animated.View key={slide.key} style={{ width: windowWidth, alignItems: 'center', justifyContent: 'center', opacity }}>
                <Animated.View style={[s.illustrationCard, { transform: [{ translateX: parallax }] }]}>
                  <Text style={s.illustrationGlyph}>{slide.glyph}</Text>
                </Animated.View>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>

      <View style={s.bottomWrap}>
        <View style={s.textBlock}>
          <Text style={s.title}>{activeSlide.title}</Text>
          <Text style={s.subtitle}>{activeSlide.subtitle}</Text>
        </View>

        <View style={s.dotsRow}>
          {slides.map((slide, index) => (
            <Pressable key={slide.key} disabled={isSubmitting} onPress={() => setActiveIndex(index)} style={[s.dot, index === activeIndex && s.dotActive, isSubmitting && s.disabled]} />
          ))}
        </View>

        {isLast ? (
          <Pressable onPress={goNext} disabled={isSubmitting} style={[s.primaryBtn, isSubmitting && s.disabled]}>
            <Text style={s.primaryBtnText}>{isSubmitting ? tx('common.loading', 'Loading...') : tx('onboarding.getStarted', 'Get Started')}</Text>
          </Pressable>
        ) : (
          <View style={s.actionsRowRightOnly}>
            <Pressable onPress={goNext} disabled={isSubmitting} style={[s.primaryBtnInline, isSubmitting && s.disabled]}>
              <Text style={s.primaryBtnText}>{tx('common.next', 'Next')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.page,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 28,
      justifyContent: 'space-between',
    },
    disabled: { opacity: 0.55 },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    skipGhostBtn: {
      minHeight: 34,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.brandPrimary,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipText: { fontSize: 14, color: c.brandPrimary, fontWeight: '600' },
    topIllustrationWrap: { flex: 0.55, overflow: 'hidden', justifyContent: 'center' },
    illustrationCard: {
      width: 320,
      maxWidth: '95%',
      aspectRatio: 1.35,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.brandPrimary,
      backgroundColor: c.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    illustrationGlyph: { fontSize: 44, color: c.brandPrimary, fontWeight: '700' },
    bottomWrap: { flex: 0.45, justifyContent: 'space-between', paddingBottom: 4 },
    textBlock: { alignItems: 'center', paddingTop: 8 },
    title: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
      letterSpacing: -0.6,
    },
    subtitle: {
      marginTop: 10,
      maxWidth: 320,
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 26,
      color: c.textMuted,
    },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: c.border },
    dotActive: { width: 28, backgroundColor: c.brandPrimary },
    actionsRowRightOnly: { flexDirection: 'row', justifyContent: 'flex-end' },
    primaryBtnInline: {
      minWidth: 144,
      minHeight: 52,
      borderRadius: 9999,
      backgroundColor: c.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: {
      width: '100%',
      minHeight: 52,
      borderRadius: 9999,
      backgroundColor: c.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { fontSize: 15, color: c.page, fontWeight: '700' },
  });
}
