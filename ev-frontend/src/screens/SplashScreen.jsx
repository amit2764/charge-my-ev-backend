import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { colorTokens } from '../theme/colors';

const D = colorTokens.dark;

export default function SplashScreen({ onComplete }) {
  const { t, locale } = useI18n();
  const [isExiting, setIsExiting] = useState(false);

  const appName = t('splash.appName');
  const taglineFromI18n = t('splash.tagline');

  const tagline = useMemo(() => {
    if (taglineFromI18n !== 'splash.tagline') return taglineFromI18n;
    return locale === 'hi' ? 'स्मार्ट चार्जिंग। पावर शेयर करें।' : 'Charge Smarter. Share Power.';
  }, [taglineFromI18n, locale]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsExiting(true), 1800);
    const doneTimer = setTimeout(() => {
      if (typeof onComplete === 'function') onComplete();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: D.page,
        color: D.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <style>{`
        @keyframes splashLogoIn {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splashNameIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashTaglineIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes splashProgressFill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>

      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: `2px solid ${D.brandPrimarySoft}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'splashLogoIn 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          opacity: 0,
          boxShadow: `0 0 24px ${D.brandPrimarySoft}`,
        }}
        aria-hidden="true"
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13.4 2.5L5.3 13.2h5.7l-0.8 8.3 8.5-11.7h-5.5l0.2-7.3z" fill={D.brandPrimary} />
        </svg>
      </div>

      <h1
        style={{
          margin: '18px 0 8px',
          fontSize: 32,
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          animation: 'splashNameIn 360ms ease-out 300ms forwards',
          opacity: 0,
        }}
      >
        {appName}
      </h1>

      <p
        style={{
          margin: 0,
          padding: '0 24px',
          textAlign: 'center',
          fontSize: 14,
          lineHeight: 1.5,
          color: D.textMuted,
          animation: 'splashTaglineIn 320ms ease-out 800ms forwards',
          opacity: 0,
        }}
      >
        {tagline}
      </p>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: D.brandPrimarySoft,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            background: D.brandPrimary,
            transformOrigin: 'left center',
            animation: 'splashProgressFill 1.5s linear 0.3s forwards',
            transform: 'scaleX(0)',
          }}
        />
      </div>
    </div>
  );
}
