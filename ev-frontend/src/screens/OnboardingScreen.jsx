import React, { useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

export default function OnboardingScreen({ isFirstInstall = true, onComplete }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startXRef = useRef(0);
  const pointerIdRef = useRef(null);

  function tx(key, fallback) {
    const val = t(key);
    return val === key ? fallback : val;
  }

  const slides = [
    {
      key: 'find-charger',
      title: tx('onboarding.slide1.title', 'Find a Charger Near You'),
      subtitle: tx('onboarding.slide1.subtitle', 'पास में चार्जर खोजें'),
      Illustration: () => <SlideIllustration kind="map" c={c} />,
    },
    {
      key: 'share-earn',
      title: tx('onboarding.slide2.title', 'Share Your Charger, Earn Money'),
      subtitle: tx('onboarding.slide2.subtitle', 'अपना चार्जर शेयर करें, पैसे कमाएं'),
      Illustration: () => <SlideIllustration kind="earn" c={c} />,
    },
    {
      key: 'safe-fast-cashless',
      title: tx('onboarding.slide3.title', 'Safe, Fast, Cashless'),
      subtitle: tx('onboarding.slide3.subtitle', 'सुरक्षित, तेज़, कैशलेस'),
      Illustration: () => <SlideIllustration kind="shield" c={c} />,
    },
  ];

  if (!isFirstInstall) return null;

  const isLast = activeIndex === slides.length - 1;
  const activeSlide = slides[activeIndex];

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

  function handleDragEnd(totalDelta) {
    if (isSubmitting) {
      setDragX(0);
      setDragging(false);
      return;
    }
    const threshold = 52;
    if (totalDelta < -threshold) goNext();
    else if (totalDelta > threshold) goPrev();
    setDragX(0);
    setDragging(false);
  }

  function onPointerDown(e) {
    if (isSubmitting) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    setDragging(true);
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    setDragX(e.clientX - startXRef.current);
  }

  function onPointerUp(e) {
    if (pointerIdRef.current !== e.pointerId) return;
    handleDragEnd(dragX);
    pointerIdRef.current = null;
  }

  const dragPercent = Math.max(-35, Math.min(35, (dragX / Math.max(window.innerWidth || 360, 320)) * 100));

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(1200px 500px at 50% -10%, ${c.brandPrimarySoft}, transparent 52%), ${c.page}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: c.text,
        padding: '24px 20px 28px',
      }}
    >
      <style>{`
        @keyframes obFadeUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          type="button"
          onClick={finish}
          disabled={isSubmitting}
          style={{
            border: `1px solid ${c.brandPrimary}`,
            borderRadius: 9999,
            minHeight: 34,
            padding: '0 14px',
            background: 'transparent',
            color: c.brandPrimary,
            fontSize: 14,
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.55 : 1,
          }}
        >
          {tx('onboarding.skip', 'Skip')}
        </button>
      </div>

      <div
        style={{
          flex: 0.55,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            width: '300%',
            height: '100%',
            display: 'flex',
            transform: `translateX(calc(${-activeIndex * 100}% + ${dragPercent}%))`,
            transition: dragging ? 'none' : 'transform 320ms ease',
          }}
        >
          {slides.map((slide, idx) => {
            const distance = Math.abs(idx - activeIndex);
            const crossOpacity = Math.max(0.45, 1 - distance * 0.45 - Math.abs(dragPercent) * 0.01);
            const parallaxPx = idx === activeIndex ? dragX * 0.7 : 0;
            return (
              <div
                key={slide.key}
                style={{
                  width: `${100 / 3}%`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: crossOpacity,
                  transition: dragging ? 'none' : 'opacity 260ms ease',
                }}
              >
                <div style={{ transform: `translateX(${parallaxPx}px)`, transition: dragging ? 'none' : 'transform 260ms ease' }}>
                  <slide.Illustration />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 0.45, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div
          key={activeSlide.key}
          style={{
            animation: 'obFadeUp 320ms ease-out',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            paddingTop: 8,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.2, fontWeight: 700, textAlign: 'center', letterSpacing: '-0.02em' }}>
            {activeSlide.title}
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, fontWeight: 400, color: c.textMuted, textAlign: 'center', maxWidth: 320 }}>
            {activeSlide.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {slides.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                disabled={isSubmitting}
                onClick={() => setActiveIndex(index)}
                aria-label={`${tx('onboarding.gotoSlide', 'Go to slide')} ${index + 1}`}
                style={{
                  width: index === activeIndex ? 28 : 8,
                  height: 8,
                  borderRadius: 9999,
                  border: 'none',
                  background: index === activeIndex ? c.brandPrimary : c.border,
                  transition: 'all 180ms ease',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  padding: 0,
                  opacity: isSubmitting ? 0.55 : 1,
                }}
              />
            ))}
          </div>

          {isLast ? (
            <button
              type="button"
              onClick={goNext}
              disabled={isSubmitting}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 9999,
                border: 'none',
                background: c.brandPrimary,
                color: c.page,
                fontSize: 16,
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.55 : 1,
              }}
            >
              {isSubmitting ? tx('common.loading', 'Loading...') : tx('onboarding.getStarted', 'Get Started')}
            </button>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                style={{
                  minWidth: 144,
                  minHeight: 52,
                  borderRadius: 9999,
                  border: 'none',
                  background: c.brandPrimary,
                  color: c.page,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.55 : 1,
                }}
              >
                {tx('common.next', 'Next')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideIllustration({ kind, c }) {
  const borderColor = kind === 'map' ? c.brandPrimary : kind === 'earn' ? c.warning : c.info;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 340,
        aspectRatio: '1.35',
        borderRadius: 20,
        border: `1px solid ${borderColor}`,
        background: `linear-gradient(170deg, ${c.surfaceRaised}, ${c.surface})`,
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 20% 20%, ${c.brandPrimarySoft}, transparent 45%)` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, fontSize: 44, fontWeight: 700 }}>
        {kind === 'map' ? '📍' : kind === 'earn' ? '₹' : '⚡'}
      </div>
    </div>
  );
}
