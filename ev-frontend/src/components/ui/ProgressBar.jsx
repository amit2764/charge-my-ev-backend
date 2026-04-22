// ProgressBar component
// Props: value (0-100), variant (teal|violet|success|warning|error), size (sm|md|lg)
//        label, showValue, animated, style

import React from 'react';
import { colors } from '../../theme';
import { useTheme } from '../../hooks/useTheme';

const TRACK_COLOR = {
  teal:    colors.primary,
  violet:  colors.secondary,
  success: colors.success,
  warning: colors.warning,
  error:   colors.error,
};

const HEIGHTS = { sm: '4px', md: '8px', lg: '12px' };

export default function ProgressBar({
  value = 0,
  variant = 'teal',
  size = 'md',
  label,
  showValue = false,
  animated = true,
  style = {},
}) {
  const { isDark, colors: c } = useTheme();
  const mode = c.mode;
  const clamped = Math.min(100, Math.max(0, value));
  const trackColor = TRACK_COLOR[variant] ?? TRACK_COLOR.teal;
  const height = HEIGHTS[size] ?? HEIGHTS.md;

  return (
    <div style={{ width: '100%', ...style }}>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {label && (
            <span style={{ fontSize: '13px', color: mode.textSecondary, fontWeight: '500' }}>
              {label}
            </span>
          )}
          {showValue && (
            <span style={{ fontSize: '13px', color: trackColor, fontWeight: '600' }}>
              {clamped}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        style={{
          width: '100%',
          height,
          borderRadius: '9999px',
          background: isDark ? colors.dark.tooltip : colors.light.border,
          overflow: 'hidden',
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            borderRadius: '9999px',
            background: trackColor,
            transition: animated ? 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer stripe on fill */}
          {animated && clamped > 0 && (
            <>
              <style>{`@keyframes ev-bar-shine { 0% { left: -60%; } 100% { left: 130%; } }`}</style>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-60%',
                  width: '60%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                  animation: 'ev-bar-shine 2s ease-in-out infinite',
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
